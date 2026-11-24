import type * as ESTree from '@oxc-project/types';
import { visitorKeys } from 'oxc-parser';

export type { ESTree };
export type Node = ESTree.Node;
export type FunctionNode = ESTree.Function | ESTree.ArrowFunctionExpression;
export type Pattern =
  | ESTree.BindingPattern
  | ESTree.ParamPattern
  | ESTree.BindingRestElement;

/** What a node holds at one of oxc's visitor keys, which name only keys that hold nodes. */
export type Child = Node | (Node | null)[] | null | undefined;

export type Visitor = {
  /** Return `false` to skip the node's children. */
  enter(node: Node, ancestors: readonly Node[]): boolean;
};

export type PatternBinding = {
  name: string;
  node: Node;
  /** The properties leading to the name; undefined in an array or rest element. */
  path: string[] | undefined;
};

const TYPE_ANNOTATION_KEYS = new Set([
  'typeAnnotation',
  'typeArguments',
  'typeParameters',
  'returnType',
  'superTypeArguments',
  'superTypeParameters',
  'implements',
]);

const CHILD_KEYS: ReadonlyMap<string, readonly (keyof Node)[]> = new Map(
  Object.entries(visitorKeys).map(([type, keys]) => [
    type,
    keys.filter((key) => !TYPE_ANNOTATION_KEYS.has(key)) as (keyof Node)[],
  ])
);

/** Expressions that wrap another without changing what it is: `(m as any)!`. */
export const TRANSPARENT_WRAPPERS: ReadonlySet<Node['type']> = new Set<
  Node['type']
>([
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'ChainExpression',
]);

/** Depth-first; type annotations are not visited. */
export function walk(root: Node, visitor: Visitor): void {
  const ancestors: Node[] = [];

  const visit = (node: Node) => {
    const visitsChildren = visitor.enter(node, ancestors);
    if (!visitsChildren) return;

    ancestors.push(node);

    for (const key of childKeysOf(node)) {
      const value = node[key] as Child;

      if (Array.isArray(value)) {
        for (const item of value) if (item) visit(item);
      } else if (value) {
        visit(value);
      }
    }

    ancestors.pop();
  };

  visit(root);
}

/** Unlike `walk`, visits type annotations too. */
export function forEachNode(root: Node, visit: (node: Node) => void): void {
  visit(root);

  for (const key of (visitorKeys[root.type] ?? []) as (keyof Node)[]) {
    const value = root[key] as Child;

    if (Array.isArray(value)) {
      for (const item of value) if (item) forEachNode(item, visit);
    } else if (value) {
      forEachNode(value, visit);
    }
  }
}

function childKeysOf(node: Node): readonly (keyof Node)[] {
  return CHILD_KEYS.get(node.type) ?? [];
}

export function isFunction(node: Node): node is FunctionNode {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  );
}

export function unwrapExpression(node: Node): Node {
  for (;;) {
    switch (node.type) {
      case 'ParenthesizedExpression':
      case 'TSAsExpression':
      case 'TSSatisfiesExpression':
      case 'TSNonNullExpression':
      case 'TSTypeAssertion':
      case 'TSInstantiationExpression':
      case 'ChainExpression':
        node = node.expression;
        break;
      default:
        return node;
    }
  }
}

export function staticString(
  node: Node | null | undefined
): string | undefined {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }

  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }

  return undefined;
}

export function staticPropertyName(
  member: ESTree.MemberExpression
): string | undefined {
  const { property } = member;

  if (member.computed) return staticString(property);
  if (property.type === 'PrivateIdentifier') return `#${property.name}`;

  return property.type === 'Identifier' ? property.name : undefined;
}

export function staticKeyName(property: {
  key: ESTree.PropertyKey;
  computed: boolean;
}): string | undefined {
  const { key } = property;

  if (property.computed) return staticString(key);
  if (key.type === 'PrivateIdentifier') return `#${key.name}`;

  return key.type === 'Identifier' ? key.name : staticString(key);
}

export function moduleExportName(name: ESTree.ModuleExportName): string {
  return name.type === 'Literal' ? name.value : name.name;
}

export function patternBindings(
  pattern: Pattern,
  path: string[] | undefined = []
): PatternBinding[] {
  switch (pattern.type) {
    case 'Identifier':
      return [{ name: pattern.name, node: pattern, path }];

    case 'ObjectPattern':
      return pattern.properties.flatMap((property) =>
        propertyBindings(property, path)
      );

    case 'ArrayPattern':
      return pattern.elements.flatMap((element) =>
        element ? patternBindings(element, undefined) : []
      );

    case 'AssignmentPattern':
      return patternBindings(pattern.left, path);

    case 'RestElement':
      return patternBindings(pattern.argument, undefined);

    case 'TSParameterProperty':
      return patternBindings(pattern.parameter, path);
  }
}

function propertyBindings(
  property: ESTree.BindingProperty | ESTree.BindingRestElement,
  path: string[] | undefined
): PatternBinding[] {
  if (property.type === 'RestElement')
    return patternBindings(property.argument, undefined);

  const key = staticKeyName(property);
  const isKnownPath = path !== undefined && key !== undefined;

  return patternBindings(
    property.value,
    isKnownPath ? [...path, key] : undefined
  );
}

export function computeLineStarts(code: string): number[] {
  const starts = [0];

  for (let index = 0; index < code.length; index++) {
    if (code[index] === '\n') starts.push(index + 1);
  }

  return starts;
}

/** 1-based. */
export function toLineColumn(
  lineStarts: number[],
  offset: number
): { line: number; column: number } {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low < high) {
    const middle = (low + high + 1) >> 1;

    if (lineStarts[middle]! <= offset) low = middle;
    else high = middle - 1;
  }

  return { line: low + 1, column: offset - lineStarts[low]! + 1 };
}
