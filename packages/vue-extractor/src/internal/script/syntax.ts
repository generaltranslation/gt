import type { NodePath, Scope } from '@babel/traverse';
import type * as t from '@babel/types';
import { unwrapExpression } from '../utils.js';

/** Reads a member key that is already a static property literal. */
export function readMemberProperty(
  node: t.MemberExpression | t.OptionalMemberExpression
): string | undefined {
  if (!node.computed && node.property.type === 'Identifier') {
    return node.property.name;
  }
  return node.computed && node.property.type === 'StringLiteral'
    ? node.property.value
    : node.computed && node.property.type === 'NumericLiteral'
      ? String(node.property.value)
      : undefined;
}

/** Reads a direct identifier, string, or numeric object key. */
export function readObjectKey(node: t.Node): string | undefined {
  return node.type === 'Identifier'
    ? node.name
    : node.type === 'StringLiteral'
      ? node.value
      : node.type === 'NumericLiteral'
        ? String(node.value)
        : undefined;
}

/** Reads a property key without evaluating a computed expression. */
export function readPropertyKey(property: {
  computed: boolean;
  key: t.Node;
}): string | undefined {
  return property.computed && property.key.type !== 'StringLiteral'
    ? undefined
    : readObjectKey(property.key);
}

/** Reads the identifier introduced by a direct or defaulted pattern. */
export function readPatternIdentifier(node: t.Node): string | undefined {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'AssignmentPattern') {
    return readPatternIdentifier(node.left);
  }
  return undefined;
}

/** Recognizes expressions that are statically JavaScript `undefined`. */
export function isStaticallyUndefined(node: t.Node, scope: Scope): boolean {
  const expression = unwrapExpression(node);
  return (
    (expression?.type === 'Identifier' &&
      expression.name === 'undefined' &&
      !scope.getBinding('undefined')) ||
    (expression?.type === 'UnaryExpression' && expression.operator === 'void')
  );
}

/** Returns whether a binding pattern introduces the requested name. */
export function patternContains(node: t.Node, name: string): boolean {
  if (node.type === 'Identifier') return node.name === name;
  if (node.type === 'AssignmentPattern') {
    return patternContains(node.left, name);
  }
  if (node.type === 'RestElement') return patternContains(node.argument, name);
  if (node.type === 'ArrayPattern') {
    return node.elements.some(
      (element) => element && patternContains(element, name)
    );
  }
  if (node.type === 'ObjectPattern') {
    return node.properties.some((property) =>
      property.type === 'RestElement'
        ? patternContains(property.argument, name)
        : patternContains(property.value, name)
    );
  }
  return false;
}

/** Returns whether a node can introduce one or more lexical bindings. */
export function isBindingPattern(node: t.Node): boolean {
  return (
    node.type === 'Identifier' ||
    node.type === 'ObjectPattern' ||
    node.type === 'ArrayPattern' ||
    node.type === 'AssignmentPattern' ||
    node.type === 'RestElement'
  );
}

/** Identifies AST wrappers that can contain a nested assignment target. */
export function isAssignmentTargetWrapper(
  parent: NodePath<t.Node>,
  child: NodePath<t.Node>
): boolean {
  return (
    (parent.isObjectProperty() &&
      parent.node.value === child.node &&
      parent.parentPath?.isObjectPattern() === true) ||
    parent.isObjectPattern() ||
    parent.isArrayPattern() ||
    (parent.isRestElement() && parent.node.argument === child.node) ||
    (parent.isAssignmentPattern() && parent.node.left === child.node)
  );
}
