import { VisitNode } from '@babel/traverse';
import { TransformState } from '../state/types';
import * as t from '@babel/types';
import { trackAssignmentExpression } from '../transform/tracking/trackAssignmentExpression';

/**
 * Process assignment expressions
 * - let t = useGT(); t = undefined;
 */
export function processAssignmentExpression(
  state: TransformState
): VisitNode<t.Node, t.AssignmentExpression> {
  return (path) => {
    trackAssignmentExpression(state.scopeTracker, path.node);
  };
}
