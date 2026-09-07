import traverseModule, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { componentName, runtimeBinding } from './bindings.js';
import { createEnumConstants } from './enumConstants.js';
import {
  attributeSlot,
  childrenSlot,
  inlineObject,
  type ValuePath,
  type Slot,
} from './syntax.js';

const traverse = traverseModule.default || traverseModule;
const cachedPrograms = new WeakMap<t.Program, NodePath<t.Program>>();
const projectedPrograms = new WeakSet<t.Program>();
const runtimeElements = new WeakSet<t.JSXElement>();
const runtimeComponentNames = new WeakMap<t.JSXElement, string>();
const quotedRuntimeChildren = new WeakSet<t.JSXAttribute>();
const enumGlobalLiterals = new WeakMap<t.Node, string>();

function tagName(node: t.Expression): t.JSXElement['openingElement']['name'] {
  if (t.isIdentifier(node)) return t.jsxIdentifier(node.name);
  if (t.isStringLiteral(node)) return t.jsxIdentifier(node.value);
  if (
    t.isMemberExpression(node) &&
    !node.computed &&
    t.isIdentifier(node.property)
  ) {
    const object = tagName(node.object as t.Expression);
    if (!t.isJSXNamespacedName(object))
      return t.jsxMemberExpression(object, t.jsxIdentifier(node.property.name));
  }
  // Ordinary element types are assigned structural IDs by extraction. Keep the
  // original type expression in an ignored spread so nested references survive.
  return t.jsxIdentifier('GtAutoJsxExpression');
}

function representableTag(node: t.Expression): boolean {
  return (
    t.isIdentifier(node) ||
    t.isStringLiteral(node) ||
    (t.isMemberExpression(node) &&
      !node.computed &&
      t.isIdentifier(node.property) &&
      (t.isIdentifier(node.object) ||
        (t.isMemberExpression(node.object) && representableTag(node.object))))
  );
}

function ignoredExpression(expression: t.Expression): t.JSXSpreadAttribute {
  return t.jsxSpreadAttribute(
    t.objectExpression([t.objectProperty(t.identifier('value'), expression)])
  );
}

function objectAttributes(
  props: t.ObjectExpression,
  runtime: boolean
): t.JSXElement['openingElement']['attributes'] {
  const attributes: t.JSXElement['openingElement']['attributes'] = [];
  for (const property of props.properties) {
    if (t.isSpreadElement(property)) {
      attributes.push(t.jsxSpreadAttribute(property.argument));
      continue;
    }
    if (!t.isObjectProperty(property) || !t.isExpression(property.value)) {
      attributes.push(t.jsxSpreadAttribute(t.objectExpression([property])));
      continue;
    }
    const name = t.isIdentifier(property.key)
      ? property.key.name
      : t.isStringLiteral(property.key)
        ? property.key.value
        : undefined;
    if (!name || !/^[A-Za-z_$][\w$:.-]*$/.test(name)) {
      attributes.push(t.jsxSpreadAttribute(t.objectExpression([property])));
      continue;
    }
    if (name === 'children' && !t.isIdentifier(property.key) && !runtime) {
      attributes.push(t.jsxSpreadAttribute(t.objectExpression([property])));
      continue;
    }
    const attribute = t.jsxAttribute(
      t.jsxIdentifier(name),
      t.jsxExpressionContainer(property.value)
    );
    if (name === 'children' && !t.isIdentifier(property.key))
      quotedRuntimeChildren.add(attribute);
    attributes.push(attribute);
  }
  return attributes;
}

/**
 * Build an extraction-only view. The original source AST is never replaced or
 * printed from this view; runtime helpers, static array flags, TS and comments
 * remain untouched in emitted CLI code.
 */
export function autoJsxExtractionProgram(
  program: NodePath<t.Program>
): NodePath<t.Program> {
  if (projectedPrograms.has(program.node)) return program;
  const cached = cachedPrograms.get(program.node);
  if (cached) return cached;

  const ast = t.file(t.cloneNode(program.node, true));
  const constant = createEnumConstants(ast);
  traverse(ast, {
    MemberExpression(path) {
      if (!path.isReferenced()) return;
      const value = constant(path);
      if (value === undefined) return;
      const literal =
        typeof value === 'string'
          ? t.stringLiteral(value)
          : Number.isNaN(value)
            ? t.identifier('NaN')
            : value === Infinity
              ? t.identifier('Infinity')
              : value === -Infinity
                ? t.unaryExpression('-', t.identifier('Infinity'))
                : t.numericLiteral(value);
      if (t.isIdentifier(literal))
        enumGlobalLiterals.set(literal, String(value));
      path.replaceWith(t.inherits(literal, path.node));
    },
  });
  traverse(ast, {
    'TSAsExpression|TSSatisfiesExpression|TSNonNullExpression|TSTypeAssertion|TSInstantiationExpression|ParenthesizedExpression':
      {
        exit(path: NodePath) {
          path.replaceWith((path.node as t.TSAsExpression).expression);
        },
      },
    JSXOpeningElement(path) {
      if (runtimeElements.has(path.parentPath.node as t.JSXElement)) return;
      path.node.attributes = path.get('attributes').flatMap((attribute) => {
        if (!attribute.isJSXSpreadAttribute()) return [attribute.node];
        const object = inlineObject(attribute.get('argument'));
        return object ? objectAttributes(object.node, false) : [attribute.node];
      });
    },
    JSXAttribute(path) {
      if (t.isStringLiteral(path.node.value)) {
        // Babel's automatic JSX transform applies this cleanup to quoted props.
        path.node.value.value = path.node.value.value.replace(/\n\s+/g, ' ');
      }
    },
    JSXText(path) {
      const children = t.react.buildChildren(
        t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), [
          path.node,
        ])
      );
      if (children.length === 0)
        path.replaceWith(t.jsxExpressionContainer(t.jsxEmptyExpression()));
      else
        path.replaceWith(t.jsxExpressionContainer(children[0] as t.Expression));
    },
    CallExpression: {
      exit(path) {
        if (!runtimeBinding(path)) return;
        const [component, props, ...extraArguments] = path.node.arguments;
        if (!t.isExpression(component) || !t.isObjectExpression(props)) return;
        const attributes = objectAttributes(props, true);
        // Keep every subtree reachable for independent auto-T extraction, while
        // key/dev metadata retain their original non-prop meaning.
        if (!representableTag(component))
          attributes.push(ignoredExpression(component));
        if (extraArguments.length)
          attributes.push(
            ignoredExpression(
              t.arrayExpression(extraArguments as t.ArrayExpression['elements'])
            )
          );
        const element = t.inherits(
          t.jsxElement(
            t.jsxOpeningElement(tagName(component), attributes, true),
            null,
            []
          ),
          path.node
        );
        runtimeElements.add(element);
        const gtName = componentName(path);
        if (gtName) runtimeComponentNames.set(element, gtName);
        path.replaceWith(element);
      },
    },
  });

  let result!: NodePath<t.Program>;
  traverse(ast, {
    Program(path) {
      path.scope.crawl();
      result = path;
      path.stop();
    },
  });
  projectedPrograms.add(result.node);
  cachedPrograms.set(program.node, result);
  return result;
}

/** Read the same first children property used by insertion, without moving it. */
function extractionSlot(
  path: NodePath<t.JSXElement | t.JSXFragment>
): Slot | undefined {
  if (path.isJSXElement() && runtimeElements.has(path.node)) {
    for (const attr of path.get('openingElement').get('attributes')) {
      if (
        attr.isJSXAttribute() &&
        t.isJSXIdentifier(attr.node.name, { name: 'children' }) &&
        !quotedRuntimeChildren.has(attr.node)
      )
        return attributeSlot(attr);
    }
    return;
  }
  return childrenSlot(path);
}

export function autoJsxExtractionChildren(
  path: NodePath<t.JSXElement | t.JSXFragment>
): ValuePath[] {
  return extractionSlot(path)?.values() ?? [];
}

export function autoJsxExtractionChildrenAreArray(
  path: NodePath<t.JSXElement | t.JSXFragment>
): boolean {
  return extractionSlot(path)?.array ?? false;
}

export function autoJsxExtractionComponentName(
  path: NodePath<t.JSXElement>
): string | undefined {
  return runtimeElements.has(path.node)
    ? runtimeComponentNames.get(path.node)
    : componentName(path);
}

/** Compiler-recognized global children remain static only when unshadowed. */
export function autoJsxExtractionLiteral(
  path: NodePath
): { value: string | null } | undefined {
  // Inlined enum globals retain their module meaning even when a user binding
  // with the same spelling exists where the enum member was originally read.
  const enumValue = enumGlobalLiterals.get(path.node);
  if (enumValue !== undefined) return { value: enumValue };
  if (!path.isIdentifier() || path.scope.getBinding(path.node.name)) return;
  if (path.node.name === 'undefined') return { value: null };
  if (path.node.name === 'NaN' || path.node.name === 'Infinity')
    return { value: path.node.name };
}
