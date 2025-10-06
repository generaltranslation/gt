import { VisitNode } from '@babel/traverse';
import { TransformState } from '../../state/types';
import * as t from '@babel/types';

/**
 * Process call expression:
 */
export function processCallExpression(
  state: TransformState
): VisitNode<t.Node, t.CallExpression> {
  return (path) => {};
}
