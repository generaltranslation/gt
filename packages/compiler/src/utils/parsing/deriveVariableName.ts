import * as t from '@babel/types';

/**
 * Derive a human-readable variable name from an AST expression.
 * - Identifier → use its name
 * - MemberExpression with non-computed Identifier property → use property name
 * - Everything else → "expr"
 */
export function deriveVariableName(node: t.Expression): string {
  if (t.isIdentifier(node)) {
    return node.name;
  }
  if (
    t.isMemberExpression(node) &&
    !node.computed &&
    t.isIdentifier(node.property)
  ) {
    return node.property.name;
  }
  return 'expr';
}
