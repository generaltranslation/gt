import { NodePath } from '@babel/traverse';
import { TransformState } from '../state/types';
import * as t from '@babel/types';
import { trackAssignmentExpression } from '../transform/tracking/trackAssignmentExpression';

/**
 * Process assignment expressions
 * - let t = useGT(); t = undefined;
 */
export function processAssignmentExpression(
  path: NodePath<t.AssignmentExpression>,
  state: TransformState
): void {
  trackAssignmentExpression(state.importTracker.scopeTracker, path.node);
}
