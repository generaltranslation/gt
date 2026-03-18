import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

/**
 * Recursively flatten a left-recursive BinaryExpression tree with '+' operator
 * into an ordered array of Expression nodes.
 *
 * Non-'+' BinaryExpressions are returned as a single element.
 */
export function flattenConcatenation(
  path: NodePath<t.Expression>
): NodePath<t.Expression>[] {
  if (path.isBinaryExpression() && path.node.operator === '+') {
    return [
      ...flattenConcatenation(path.get('left') as NodePath<t.Expression>),
      ...flattenConcatenation(path.get('right') as NodePath<t.Expression>),
    ];
  }
  return [path];
}
