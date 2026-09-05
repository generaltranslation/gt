import { parse } from '@babel/parser';
import traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { isStaticExpression } from '../../../../cli/src/react/jsx/evaluateJsx';
import { getPathsAndAliases } from '../../../../cli/src/react/jsx/utils/getPathsAndAliases';
import {
  GT_LIBRARIES_UPSTREAM,
  Libraries,
} from '../../../../cli/src/types/libraries';
import { isGTImportSource } from '../../../../compiler/src/utils/constants/gt/helpers';
import {
  canonical,
  hasUnsupportedJsxCalls,
  isJsxPragmaComment,
  lower,
  oracle,
} from './oracle';
import { cliResult } from './cli-oracle';

/** Reviewed differences between the raw-JSX CLI and compiled-JSX compiler. */
export const cliDivergences = {
  'expression-text':
    'The compiler claims translation regions for nonempty string/template expressions; the CLI only uses JSXText to claim them.',
  'children-attribute':
    'The compiler processes the first lowered children property, including explicit, duplicated and spread properties; the CLI processes JSX child syntax instead.',
  'child-array':
    'The compiler decomposes a sole children array at the current region; the CLI treats its expression as one value and cannot use its strings to claim a region.',
  'expression-jsx-region':
    'The compiler passes the containing translation region into direct JSX-valued children; the CLI discovers JSX inside braces independently.',
  'static-expression':
    'The compiler treats undefined/NaN/Infinity as static and only negative numeric unary expressions as static; the CLI applies different expression rules.',
  'typescript-expression':
    'The compiler sees expressions after TypeScript wrappers are erased; the CLI classifies the original asserted expression.',
  'manual-t-descendants':
    'The CLI suppresses every descendant of user T; the compiler still discovers JSX in non-children props and indirect child expressions.',
  'opaque-root-props':
    'The CLI replaces a root Branch/Plural/Derive path before processing its props, so it processes the new wrapper instead of the original opaque component.',
  'opaque-prop-descendants':
    'The CLI marks all JSX below opaque control/spread props and nested JSX props; the compiler independently visits JSX outside direct content children.',
  'derive-prop-descendants':
    'The CLI marks JSX inside Derive prop expressions after adding Var; the compiler independently transforms JSX inside those expressions.',
  'derive-children':
    'The CLI processes explicit Derive children as an ordinary content prop, or marks nested Derive children while processing a surrounding opaque component; the compiler leaves Derive children for independent discovery.',
  'opaque-key':
    'The CLI treats an opaque component key as translatable content; React has already lifted key out of props before the compiler runs.',
  'create-element-fallback':
    'A key after a spread lowers to React.createElement, which the compiler insertion pass does not recognize; the CLI still sees JSX.',
  'import-shadowing':
    'The CLI recognizes GT aliases by their file-wide spelling; the compiler resolves the lexical binding at each JSX use.',
  'type-only-import':
    'The CLI includes type-only GT imports in component aliases; those imports are erased before the compiler runs.',
  'intrinsic-import-alias':
    'The CLI recognizes a lowercase GT alias as a component; JSX lowering treats that spelling as an intrinsic string tag.',
  'string-import-name':
    'The compiler recognizes string-named import specifiers; the CLI import collector only recognizes identifier-named specifiers.',
  'import-source-prefix':
    'The CLI accepts arbitrary gt-next/gt-react source prefixes; the compiler recognizes only its explicit set of import sources.',
  'existing-internal-helper':
    'The compiler skips existing internal wrapper nodes; the CLI treats an existing internal T as ordinary JSX and an internal Var as a suppressing user variable.',
  'jsx-runtime':
    'JSX pragmas lower content to custom automatic runtime or classic factory calls that the compiler insertion pass does not recognize; the CLI still transforms the original JSX.',
} as const;

export type CliDivergence = keyof typeof cliDivergences;

/** Minimal counterexamples and nearby controls that both references agree on. */
export const cliDivergenceExamples: Record<
  CliDivergence,
  { input: string; control: string }
> = {
  'expression-text': {
    input: 'export const Page = () => <p>{"Hello"}</p>;',
    control: 'export const Page = () => <p>Hello</p>;',
  },
  'children-attribute': {
    input: 'export const Page = () => <p children="Hello" />;',
    control: 'export const Page = () => <p>Hello</p>;',
  },
  'child-array': {
    input: 'export const Page = () => <p>{["Hello", name]}</p>;',
    control: 'export const Page = () => <p>Hello {name}</p>;',
  },
  'expression-jsx-region': {
    input: 'export const Page = () => <p>Hello {<b>Hi {name}</b>}</p>;',
    control: 'export const Page = () => <p>Hello <b>Hi {name}</b></p>;',
  },
  'static-expression': {
    input: 'export const Page = () => <p>Hello {undefined}</p>;',
    control: 'export const Page = () => <p>Hello {name}</p>;',
  },
  'typescript-expression': {
    input: 'export const Page = () => <p>Hello {("world" as string)}</p>;',
    control: 'export const Page = () => <p>Hello {(name as string)}</p>;',
  },
  'manual-t-descendants': {
    input:
      'import { T } from "gt-next"; export const Page = () => <T>{ok && <b>Hello {name}</b>}</T>;',
    control:
      'import { T } from "gt-next"; export const Page = () => <T><b>Hello {name}</b></T>;',
  },
  'opaque-root-props': {
    input:
      'import { Branch } from "gt-next"; export const Page = () => <Branch branch={mode} yes={name} />;',
    control:
      'import { Branch } from "gt-next"; export const Page = () => <p><Branch branch={mode} yes={name} /></p>;',
  },
  'opaque-prop-descendants': {
    input:
      'import { Branch } from "gt-next"; export const Page = () => <p><Branch branch={<b>Choice {name}</b>} yes="Yes" /></p>;',
    control:
      'import { Branch } from "gt-next"; export const Page = () => <p><Branch branch={mode} yes="Yes" /></p>;',
  },
  'derive-prop-descendants': {
    input:
      'import { Derive } from "gt-next"; export const Page = () => <p><Derive context={ok ? <b>Hello {name}</b> : null} /></p>;',
    control:
      'import { Derive } from "gt-next"; export const Page = () => <p><Derive context={name} /></p>;',
  },
  'derive-children': {
    input:
      'import { Derive } from "gt-next"; export const Page = () => <p><Derive children={<b>Hello {name}</b>} /></p>;',
    control:
      'import { Derive } from "gt-next"; export const Page = () => <p><Derive><b>Hello {name}</b></Derive></p>;',
  },
  'opaque-key': {
    input:
      'import { Branch } from "gt-next"; export const Page = () => <p><Branch key={name} yes="Yes" /></p>;',
    control:
      'import { Branch } from "gt-next"; export const Page = () => <p><Branch key="stable" yes="Yes" /></p>;',
  },
  'create-element-fallback': {
    input:
      'export const Page = () => <p {...props} key={name}>Hello {name}</p>;',
    control:
      'export const Page = () => <p key={name} {...props}>Hello {name}</p>;',
  },
  'import-shadowing': {
    input:
      'import { T } from "gt-next"; export const Keep = T; export const Page = (T) => <T>Hello {name}</T>;',
    control:
      'import { T } from "gt-next"; export const Keep = T; export const Page = () => <T>Hello {name}</T>;',
  },
  'type-only-import': {
    input:
      'import type { T } from "gt-next"; const T = Local; export const Page = () => <T>Hello {name}</T>;',
    control: 'const T = Local; export const Page = () => <T>Hello {name}</T>;',
  },
  'intrinsic-import-alias': {
    input:
      'import { T as t } from "gt-next"; export const Page = () => <t>Hello {name}</t>;',
    control:
      'import { T as Translate } from "gt-next"; export const Page = () => <Translate>Hello {name}</Translate>;',
  },
  'string-import-name': {
    input:
      'import { "T" as T } from "gt-next"; export const Page = () => <T>Hello {name}</T>;',
    control:
      'import { T } from "gt-next"; export const Page = () => <T>Hello {name}</T>;',
  },
  'import-source-prefix': {
    input:
      'import { T } from "gt-next/custom"; export const Page = () => <T>Hello {name}</T>;',
    control:
      'import { T } from "gt-next"; export const Page = () => <T>Hello {name}</T>;',
  },
  'existing-internal-helper': {
    input:
      'import { GtInternalTranslateJsx } from "gt-next"; export const Page = () => <GtInternalTranslateJsx>Hello {name}</GtInternalTranslateJsx>;',
    control:
      'import { T } from "gt-next"; export const Page = () => <T>Hello {name}</T>;',
  },
  'jsx-runtime': {
    input:
      '/** @jsxImportSource @emotion/react */ export const Page = () => <p>Hello {name}</p>;',
    control:
      '/** @jsxImportSource react */ export const Page = () => <p>Hello {name}</p>;',
  },
};

type JsxPath = NodePath<t.JSXElement | t.JSXFragment>;
const opaque = new Set(['Branch', 'Plural', 'Derive']);
const variables = new Set([
  'Var',
  'Num',
  'Currency',
  'DateTime',
  'RelativeTime',
]);
const components = new Set([
  'T',
  ...opaque,
  ...variables,
  'GtInternalTranslateJsx',
  'GtInternalVar',
]);

function unwrap(node: t.Node): t.Node {
  while (
    t.isTSAsExpression(node) ||
    t.isTSSatisfiesExpression(node) ||
    t.isTSNonNullExpression(node) ||
    t.isTSTypeAssertion(node) ||
    t.isParenthesizedExpression(node)
  )
    node = node.expression;
  return node;
}

function text(node: t.Node | null | undefined): boolean {
  if (!node) return false;
  node = unwrap(node);
  if (t.isJSXText(node) || t.isStringLiteral(node))
    return node.value.trim().length > 0;
  return (
    t.isTemplateLiteral(node) &&
    node.expressions.length === 0 &&
    Boolean(node.quasis[0]?.value.cooked?.trim())
  );
}

function hasJsx(node: t.Node): boolean {
  let found = false;
  t.traverseFast(node, (child) => {
    if (t.isJSXElement(child) || t.isJSXFragment(child)) found = true;
  });
  return found;
}

function dynamic(node: t.Node): boolean {
  return t.isExpression(node) && !isStaticExpression(node, true).isStatic;
}

function attrName(node: t.JSXAttribute): string | undefined {
  return t.isJSXIdentifier(node.name) ? node.name.name : undefined;
}

function attrExpression(node: t.JSXAttribute): t.Node | undefined {
  return t.isJSXExpressionContainer(node.value)
    ? node.value.expression
    : (node.value ?? undefined);
}

function control(
  component: string | undefined,
  name: string | undefined
): boolean {
  return component === 'Branch'
    ? name === 'branch' || Boolean(name?.startsWith('data-'))
    : component === 'Plural' && (name === 'n' || name === 'locales');
}

/**
 * Explain source sites whose insertion rules are known to differ. This does not
 * transform source or excuse a golden mismatch: both live reference outputs must
 * still match their separately committed goldens. Names of examples are unused.
 */
export function classifyCliDivergences(input: string): CliDivergence[] {
  const ast = parse(input, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx', 'decorators-legacy'],
  });
  const paths = getPathsAndAliases(
    ast,
    GT_LIBRARIES_UPSTREAM[Libraries.GT_NEXT]
  );
  const aliases = { ...paths.importAliases };
  for (const { localName, originalName } of paths.translationComponentPaths)
    aliases[localName] = originalName;
  const imports = new Map<
    string,
    {
      imported: string;
      source: string;
      typeOnly: boolean;
      stringName: boolean;
      node: t.ImportSpecifier;
    }
  >();
  for (const statement of ast.program.body) {
    if (!t.isImportDeclaration(statement)) continue;
    for (const specifier of statement.specifiers) {
      if (!t.isImportSpecifier(specifier)) continue;
      const imported = t.isIdentifier(specifier.imported)
        ? specifier.imported.name
        : specifier.imported.value;
      if (!components.has(imported)) continue;
      imports.set(specifier.local.name, {
        imported,
        source: statement.source.value,
        typeOnly:
          statement.importKind === 'type' || specifier.importKind === 'type',
        stringName: t.isStringLiteral(specifier.imported),
        node: specifier,
      });
    }
  }
  const reasons = new Set<CliDivergence>();
  if (
    ast.comments?.some((comment) => isJsxPragmaComment(comment.value)) &&
    hasJsx(ast) &&
    hasUnsupportedJsxCalls(lower(input, true)) &&
    cliResult(input).canonical !== canonical(oracle(input))
  )
    reasons.add('jsx-runtime');
  const tagName = (path: JsxPath): string | undefined =>
    path.isJSXElement() && t.isJSXIdentifier(path.node.openingElement.name)
      ? path.node.openingElement.name.name
      : undefined;
  const compilerName = (path: JsxPath): string | undefined => {
    const name = tagName(path);
    const imported = name && imports.get(name);
    return imported &&
      !imported.typeOnly &&
      isGTImportSource(imported.source) &&
      !t.react.isCompatTag(name!) &&
      path.scope.getBinding(name!)?.path.node === imported.node
      ? imported.imported
      : undefined;
  };
  const cliName = (path: JsxPath): string | undefined =>
    aliases[tagName(path) ?? ''];
  const sharedVariableAncestor = (path: NodePath): boolean =>
    Boolean(
      path.findParent((ancestor) => {
        if (!ancestor.isJSXElement()) return false;
        const name = compilerName(ancestor);
        return Boolean(
          name && variables.has(name) && name === cliName(ancestor)
        );
      })
    );
  const sharedTAncestor = (
    path: NodePath
  ): NodePath<t.JSXElement> | undefined =>
    path.findParent(
      (ancestor) =>
        ancestor.isJSXElement() &&
        compilerName(ancestor) === 'T' &&
        cliName(ancestor) === 'T'
    ) as NodePath<t.JSXElement> | undefined;
  const children = (path: JsxPath) =>
    path
      .get('children')
      .filter(
        (child) =>
          !(
            child.isJSXText() &&
            t.react.buildChildren(
              t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), [
                child.node,
              ])
            ).length === 0
          ) &&
          !(
            child.isJSXExpressionContainer() &&
            t.isJSXEmptyExpression(child.node.expression)
          )
      );
  const explicitChildren = (path: JsxPath): t.Node | undefined => {
    if (!path.isJSXElement()) return undefined;
    const attribute = path.node.openingElement.attributes.find(
      (attr) => t.isJSXAttribute(attr) && attrName(attr) === 'children'
    );
    return t.isJSXAttribute(attribute) ? attrExpression(attribute) : undefined;
  };
  const claims = (path: JsxPath): boolean => {
    if (
      children(path).some(
        (child) =>
          text(child.node) ||
          (child.isJSXExpressionContainer() && text(child.node.expression)) ||
          (child.isJSXElement() && opaque.has(compilerName(child) ?? ''))
      )
    )
      return true;
    const explicit = explicitChildren(path);
    if (explicit && text(explicit)) return true;
    const sole = children(path);
    const value =
      explicit ??
      (sole.length === 1 && sole[0].isJSXExpressionContainer()
        ? sole[0].node.expression
        : undefined);
    return Boolean(
      value &&
      t.isArrayExpression(unwrap(value)) &&
      (unwrap(value) as t.ArrayExpression).elements.some(text)
    );
  };
  const owns = (path: JsxPath): boolean => {
    const name = compilerName(path);
    if (
      name === 'T' ||
      variables.has(name ?? '') ||
      name?.startsWith('GtInternal')
    )
      return false;
    if (opaque.has(name ?? '')) return name !== 'Derive';
    return claims(path) || inherited(path);
  };
  const inherited = (path: NodePath): boolean => {
    const parent = path.parentPath;
    if (!parent) return false;
    if (
      (parent.isJSXElement() || parent.isJSXFragment()) &&
      path.listKey === 'children'
    )
      return owns(parent);
    if (
      parent.isJSXExpressionContainer() ||
      parent.isTSAsExpression() ||
      parent.isTSSatisfiesExpression() ||
      parent.isTSNonNullExpression()
    )
      return inherited(parent);
    if (parent.isJSXAttribute()) {
      const owner = parent.parentPath?.parentPath;
      if (!owner?.isJSXElement()) return false;
      const name = compilerName(owner);
      if (opaque.has(name ?? '') && !control(name, attrName(parent.node)))
        return attrName(parent.node) !== 'children' || name !== 'Derive';
      return attrName(parent.node) === 'children' && owns(owner);
    }
    return false;
  };
  const useful = (path: JsxPath): boolean =>
    children(path).length > 0 ||
    (path.isJSXElement() &&
      path.node.openingElement.attributes.some(
        (attr) =>
          t.isJSXAttribute(attr) &&
          Boolean(attrExpression(attr) && hasJsx(attrExpression(attr)!))
      ));
  const relevantImportUse = (path: JsxPath): boolean => {
    if (opaque.has(compilerName(path) ?? cliName(path) ?? '')) return true;
    if (inherited(path) && useful(path)) return true;
    let found = false;
    path.traverse({
      JSXText(child) {
        if (
          text(child.node) &&
          !sharedVariableAncestor(child) &&
          !sharedTAncestor(child)
        )
          found = true;
      },
      JSXExpressionContainer(child) {
        if (
          text(child.node.expression) &&
          !sharedVariableAncestor(child) &&
          !sharedTAncestor(child)
        )
          found = true;
      },
      JSXElement(child) {
        if (sharedVariableAncestor(child) || sharedTAncestor(child))
          child.skip();
        else if (opaque.has(compilerName(child) ?? cliName(child) ?? ''))
          found = true;
      },
    });
    return found;
  };

  traverse(ast, {
    'JSXElement|JSXFragment'(untypedPath) {
      const path = untypedPath as JsxPath;
      if (sharedVariableAncestor(path)) return;
      const name = tagName(path);
      const imported = name && imports.get(name);
      const actual = compilerName(path);
      const cli = cliName(path);
      if (imported && relevantImportUse(path)) {
        if (imported.typeOnly && aliases[name!])
          reasons.add('type-only-import');
        if (imported.stringName && isGTImportSource(imported.source))
          reasons.add('string-import-name');
        if (aliases[name!] && !isGTImportSource(imported.source))
          reasons.add('import-source-prefix');
        if (aliases[name!] && t.react.isCompatTag(name!))
          reasons.add('intrinsic-import-alias');
        if (
          aliases[name!] &&
          !imported.typeOnly &&
          !t.react.isCompatTag(name!) &&
          path.scope.getBinding(name!)?.path.node !== imported.node
        )
          reasons.add('import-shadowing');
        if (actual?.startsWith('GtInternal'))
          reasons.add('existing-internal-helper');
      }
      const manual = sharedTAncestor(path);
      if (manual) {
        let cursor: NodePath | null = path;
        while (cursor && cursor !== manual) {
          if (
            (cursor.isJSXAttribute() && attrName(cursor.node) !== 'children') ||
            (cursor.isExpression() &&
              !cursor.isJSXElement() &&
              !cursor.isJSXFragment() &&
              !cursor.isArrayExpression() &&
              !cursor.isTSAsExpression() &&
              !cursor.isTSSatisfiesExpression() &&
              !cursor.isTSNonNullExpression())
          ) {
            if (useful(path) || opaque.has(actual ?? ''))
              reasons.add('manual-t-descendants');
            break;
          }
          cursor = cursor.parentPath;
        }
        return;
      }
      if (actual === cli && (actual === 'T' || variables.has(actual ?? '')))
        return;
      if (path.isJSXElement()) {
        const attrs = path.node.openingElement.attributes;
        const afterSpread = attrs.some(
          (attr, index) =>
            t.isJSXAttribute(attr) &&
            attrName(attr) === 'key' &&
            attrs
              .slice(0, index)
              .some((previous) => t.isJSXSpreadAttribute(previous))
        );
        if (afterSpread && (useful(path) || opaque.has(cli ?? '')))
          reasons.add('create-element-fallback');
        const childAttrs = attrs.filter(
          (attr) => t.isJSXAttribute(attr) && attrName(attr) === 'children'
        );
        if (
          !opaque.has(actual ?? '') &&
          childAttrs.length &&
          (claims(path) || inherited(path) || childAttrs.length > 1)
        )
          reasons.add('children-attribute');
        for (const attr of attrs) {
          if (
            t.isJSXSpreadAttribute(attr) &&
            t.isObjectExpression(attr.argument)
          ) {
            if (
              attr.argument.properties.some(
                (prop) =>
                  t.isObjectProperty(prop) &&
                  t.isIdentifier(prop.key, { name: 'children' }) &&
                  (text(prop.value) ||
                    hasJsx(prop.value) ||
                    t.isArrayExpression(unwrap(prop.value)) ||
                    inherited(path))
              )
            )
              reasons.add('children-attribute');
            if (
              opaque.has(actual ?? '') &&
              attr.argument.properties.some(
                (prop) =>
                  (t.isObjectProperty(prop) &&
                    (dynamic(prop.value) || hasJsx(prop.value))) ||
                  (t.isObjectMethod(prop) && hasJsx(prop))
              )
            )
              reasons.add('opaque-prop-descendants');
          }
        }
        if (opaque.has(actual ?? '') && actual === cli) {
          if (
            actual !== 'Derive' &&
            inherited(path) &&
            childAttrs.some(
              (attr) =>
                t.isJSXAttribute(attr) &&
                Boolean(
                  attrExpression(attr) &&
                  t.isArrayExpression(unwrap(attrExpression(attr)!))
                )
            )
          )
            reasons.add('child-array');
          const content = attrs.filter(
            (attr): attr is t.JSXAttribute =>
              t.isJSXAttribute(attr) &&
              !control(actual, attrName(attr)) &&
              attrName(attr) !== 'key' &&
              !(actual === 'Derive' && attrName(attr) === 'children')
          );
          if (
            !inherited(path) &&
            (content.some((attr) => {
              const value = attrExpression(attr);
              return Boolean(value && (dynamic(value) || hasJsx(value)));
            }) ||
              (actual !== 'Derive' &&
                children(path).some(
                  (child) =>
                    (child.isJSXExpressionContainer() &&
                      dynamic(child.node.expression)) ||
                    (child.isJSXElement() && useful(child))
                )))
          )
            reasons.add('opaque-root-props');
          if (
            inherited(path) &&
            attrs.some(
              (attr) =>
                t.isJSXAttribute(attr) &&
                attrName(attr) === 'key' &&
                Boolean(attrExpression(attr) && dynamic(attrExpression(attr)!))
            )
          )
            reasons.add('opaque-key');
          for (const attr of attrs) {
            if (!t.isJSXAttribute(attr)) continue;
            const value = attrExpression(attr);
            if (!value || !hasJsx(value)) continue;
            if (control(actual, attrName(attr)))
              reasons.add('opaque-prop-descendants');
            if (
              actual === 'Derive' &&
              !t.isJSXElement(unwrap(value)) &&
              !t.isJSXFragment(unwrap(value)) &&
              attrName(attr) !== 'children'
            )
              reasons.add('derive-prop-descendants');
            t.traverseFast(value, (node) => {
              if (
                t.isJSXAttribute(node) &&
                attrName(node) !== 'children' &&
                Boolean(attrExpression(node) && hasJsx(attrExpression(node)!))
              )
                reasons.add('opaque-prop-descendants');
            });
          }
          if (
            actual === 'Derive' &&
            childAttrs.some(
              (attr) =>
                t.isJSXAttribute(attr) &&
                Boolean(attrExpression(attr) && dynamic(attrExpression(attr)!))
            )
          )
            reasons.add('derive-children');
          if (
            actual === 'Derive' &&
            children(path).some((child) => hasJsx(child.node)) &&
            path.findParent(
              (ancestor) =>
                ancestor.isJSXElement() &&
                ['Branch', 'Plural'].includes(compilerName(ancestor) ?? '')
            )
          )
            reasons.add('derive-children');
        }
      }
      const ownChildren = children(path);
      for (const child of ownChildren) {
        if (!child.isJSXExpressionContainer()) continue;
        const expression = child.node.expression;
        const value = unwrap(expression);
        if (
          text(value) &&
          !inherited(path) &&
          !ownChildren.some(
            (sibling) =>
              (sibling.isJSXText() && text(sibling.node)) ||
              (sibling.isJSXElement() &&
                opaque.has(compilerName(sibling) ?? ''))
          )
        )
          reasons.add('expression-text');
        if (
          t.isArrayExpression(value) &&
          ownChildren.length === 1 &&
          (owns(path) || value.elements.some(text))
        )
          reasons.add('child-array');
        if (
          owns(path) &&
          (t.isJSXElement(value) || t.isJSXFragment(value)) &&
          value.children.length > 0
        )
          reasons.add('expression-jsx-region');
        if (
          owns(path) &&
          ((t.isIdentifier(value) &&
            ['undefined', 'NaN', 'Infinity'].includes(value.name)) ||
            (t.isUnaryExpression(value) &&
              value.operator !== '-' &&
              t.isNumericLiteral(value.argument)))
        )
          reasons.add('static-expression');
        if (
          expression !== value &&
          (owns(path) || text(value)) &&
          (text(value) ||
            t.isNumericLiteral(value) ||
            t.isBooleanLiteral(value) ||
            t.isNullLiteral(value) ||
            t.isJSXElement(value) ||
            t.isJSXFragment(value) ||
            t.isArrayExpression(value))
        )
          reasons.add('typescript-expression');
      }
    },
  });
  return [...reasons].sort();
}
