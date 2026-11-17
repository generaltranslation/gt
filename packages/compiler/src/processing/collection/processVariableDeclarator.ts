import { TransformState } from '../../state/types';
import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { trackVariableDeclarator } from '../../transform/tracking/trackVariableDeclarator';

/**
 * Process variable assignments.
 * - Track callback variables (via translation function invocations: useGT, useMessages, etc.)
 * - Track overriding variables
 *
 * GT callbacks:
 * - const t = useGT()
 *
 * Overriding variables:
 * - const t = msg("hello");
 * - const t = "Hello"
 */
export function processVariableDeclarator(
  state: TransformState
): VisitNode<t.Node, t.VariableDeclarator> {
  return (path) => {
    trackVariableDeclarator(path.node, state);
  };
}
