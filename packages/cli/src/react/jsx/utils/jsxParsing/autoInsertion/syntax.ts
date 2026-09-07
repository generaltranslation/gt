import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { runtimeBinding } from './bindings.js';

export type ValuePath = NodePath<t.Node | null | undefined>;
export type ConstantLookup = (path: ValuePath) => string | number | undefined;
export type JsxPath = NodePath<t.JSXElement | t.JSXFragment>;
export type ElementPath = NodePath<
  t.JSXElement | t.JSXFragment | t.CallExpression
>;

/** Inspect erased syntax without replacing the user's TypeScript nodes. */
export function expressionPath(path: ValuePath): ValuePath {
  while (
    path.isTSAsExpression() ||
    path.isTSSatisfiesExpression() ||
    path.isTSNonNullExpression() ||
    path.isTSTypeAssertion() ||
    path.isParenthesizedExpression() ||
    path.isTSInstantiationExpression()
  )
    path = path.get('expression') as ValuePath;
  return path;
}

export function isRuntimeJsx(path: ElementPath): boolean {
  if (path.isCallExpression()) return !!runtimeBinding(path);
  if (!path.isJSXElement()) return true;
  let spread = false;
  for (const attr of path.node.openingElement.attributes) {
    if (t.isJSXSpreadAttribute(attr)) spread = true;
    else if (spread && t.isJSXIdentifier(attr.name, { name: 'key' }))
      return false;
  }
  return true;
}

export function hasText(path: ValuePath, constant?: ConstantLookup): boolean {
  path = expressionPath(path);
  if (path.isJSXExpressionContainer())
    return hasText(path.get('expression'), constant);
  const value = constant?.(path);
  if (typeof value === 'string') return value.trim().length > 0;
  if (path.isJSXText() || path.isStringLiteral())
    return path.node.value.trim().length > 0;
  return (
    path.isTemplateLiteral() &&
    path.node.expressions.length === 0 &&
    !!path.node.quasis[0]?.value.cooked?.trim()
  );
}

export function needsVariable(
  path: ValuePath,
  constant?: ConstantLookup
): boolean {
  path = expressionPath(path);
  if (path.isJSXExpressionContainer())
    return needsVariable(path.get('expression'), constant);
  const value = constant?.(path);
  // The host emits negative infinity as a unary expression over an identifier.
  if (value !== undefined) return value === -Infinity;
  if (
    path.isJSXEmptyExpression() ||
    path.isStringLiteral() ||
    path.isNumericLiteral() ||
    path.isBooleanLiteral() ||
    path.isNullLiteral()
  )
    return false;
  if (path.isTemplateLiteral() && path.node.expressions.length === 0)
    return false;
  if (
    path.isUnaryExpression({ operator: '-' }) &&
    expressionPath(path.get('argument')).isNumericLiteral()
  )
    return false;
  if (
    path.isIdentifier() &&
    ['undefined', 'NaN', 'Infinity'].includes(path.node.name)
  )
    return false;
  if (path.isJSXElement() || path.isJSXFragment() || path.isCallExpression())
    return !isRuntimeJsx(path);
  return true;
}

function meaningful(path: NodePath): boolean {
  if (path.isJSXText()) {
    return (
      t.react.buildChildren(
        t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), [
          path.node,
        ])
      ).length > 0
    );
  }
  return (
    !path.isJSXExpressionContainer() ||
    !path.get('expression').isJSXEmptyExpression()
  );
}

export function propertyName(
  path: NodePath<t.ObjectProperty>
): string | undefined {
  const key = path.node.key;
  return t.isIdentifier(key)
    ? key.name
    : t.isStringLiteral(key)
      ? key.value
      : undefined;
}

export function inlineObject(
  path: ValuePath
): NodePath<t.ObjectExpression> | undefined {
  path = expressionPath(path);
  if (!path.isObjectExpression()) return;
  if (
    path.node.properties.some(
      (property) =>
        t.isObjectProperty(property) &&
        !property.computed &&
        !property.shorthand &&
        ((t.isIdentifier(property.key) && property.key.name === '__proto__') ||
          (t.isStringLiteral(property.key) &&
            property.key.value === '__proto__'))
    )
  )
    return;
  return path;
}

export type Slot = {
  values(): ValuePath[];
  allValues(): ValuePath[];
  raw: boolean;
  array: boolean;
  quoted: boolean;
  expression?: ValuePath;
  replace(value: t.Expression): void;
  splice(start: number, count: number, value: t.Expression): void;
  originalChildren?: () => t.JSXElement['children'];
};

export function expressionSlot(
  path: ValuePath,
  replace?: (value: t.Expression) => void,
  quoted = false
): Slot {
  const inner = expressionPath(path);
  const array = inner.isArrayExpression();
  return {
    raw: false,
    array,
    quoted,
    expression: path,
    values: () =>
      array ? (inner as NodePath<t.ArrayExpression>).get('elements') : [path],
    allValues: () =>
      array ? (inner as NodePath<t.ArrayExpression>).get('elements') : [path],
    replace:
      replace ??
      ((value) => {
        path.replaceWith(value);
      }),
    splice(start, count, value) {
      if (inner.isArrayExpression())
        inner.node.elements.splice(start, count, value);
    },
  };
}

export function bodySlot(path: JsxPath): Slot {
  const values = path.get('children').filter(meaningful);
  if (values.length === 1 && values[0].isJSXExpressionContainer()) {
    const expr = values[0].get('expression');
    if (expressionPath(expr).isArrayExpression()) return expressionSlot(expr);
  }
  return {
    raw: true,
    array: values.length > 1,
    quoted: false,
    values: () => path.get('children').filter(meaningful),
    allValues: () => path.get('children'),
    originalChildren: () => path.node.children,
    replace(value) {
      path.node.children = [
        t.isJSXElement(value) || t.isJSXFragment(value)
          ? value
          : t.jsxExpressionContainer(value),
      ];
    },
    splice(start, count, value) {
      path.node.children.splice(
        start,
        count,
        t.isJSXElement(value) || t.isJSXFragment(value)
          ? value
          : t.jsxExpressionContainer(value)
      );
    },
  };
}

/**
 * A claimed children prop makes the lowered parent use its single-child helper.
 * Preserve a later, overriding JSX body as an explicit array so its values and
 * order remain intact without reintroducing the host's static-child flag.
 */
export function makeRawBodyDynamic(path: JsxPath): void {
  const children = path.get('children').filter(meaningful);
  if (children.length <= 1) return;
  const array = t.arrayExpression(
    t.react.buildChildren(path.node) as t.ArrayExpression['elements']
  );
  const comments = path.node.children.flatMap((child) =>
    t.isJSXExpressionContainer(child) &&
    t.isJSXEmptyExpression(child.expression)
      ? (child.expression.innerComments ?? [])
      : []
  );
  if (comments.length) array.innerComments = comments;
  path.node.children = [t.jsxExpressionContainer(array)];
}

export function attributeSlot(
  path: NodePath<t.JSXAttribute>
): Slot | undefined {
  const value = path.get('value');
  if (!value.node) return;
  if (value.isJSXExpressionContainer())
    return expressionSlot(value.get('expression'));
  return expressionSlot(
    value,
    (node) => {
      value.replaceWith(t.jsxExpressionContainer(node));
    },
    value.isStringLiteral()
  );
}

/** The compiler reads the first lowered identifier-keyed children property. */
function emptySlot(): Slot {
  return {
    raw: false,
    array: false,
    quoted: false,
    values: () => [],
    allValues: () => [],
    replace() {},
    splice() {},
  };
}

export function childrenSlot(path: ElementPath): Slot {
  if (path.isCallExpression()) {
    const props = path.get('arguments')[1];
    if (props) {
      const object = expressionPath(props);
      if (object.isObjectExpression()) {
        for (const property of object.get('properties')) {
          if (
            property.isObjectProperty() &&
            t.isIdentifier(property.node.key, { name: 'children' })
          ) {
            const value = property.get('value');
            if (value.isExpression())
              return expressionSlot(value, (node) => {
                property.node.shorthand = false;
                value.replaceWith(node);
              });
            return emptySlot();
          }
        }
      }
    }
    return emptySlot();
  }
  if (path.isJSXElement()) {
    for (const attr of path.get('openingElement').get('attributes')) {
      if (
        attr.isJSXAttribute() &&
        t.isJSXIdentifier(attr.node.name, { name: 'children' })
      ) {
        const slot = attributeSlot(attr);
        return slot ?? emptySlot();
      } else if (attr.isJSXSpreadAttribute()) {
        const object = inlineObject(attr.get('argument'));
        for (const property of object?.get('properties') ?? []) {
          if (
            property.isObjectProperty() &&
            t.isIdentifier(property.node.key, { name: 'children' })
          ) {
            return expressionSlot(property.get('value'), (node) => {
              property.node.shorthand = false;
              property.get('value').replaceWith(node);
            });
          }
        }
      }
    }
  }
  return path.isJSXElement() || path.isJSXFragment()
    ? bodySlot(path)
    : emptySlot();
}
