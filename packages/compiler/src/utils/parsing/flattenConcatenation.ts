import * as t from '@babel/types';

/**
 * Recursively flatten a left-recursive BinaryExpression tree with '+' operator
 * into an ordered array of Expression nodes.
 *
 * Non-'+' BinaryExpressions are returned as a single element.
 */
export function flattenConcatenation(node: t.Expression): t.Expression[] {
  if (t.isBinaryExpression(node) && node.operator === '+') {
    return [
      ...flattenConcatenation(node.left as t.Expression),
      ...flattenConcatenation(node.right as t.Expression),
    ];
  }
  return [node];
}
