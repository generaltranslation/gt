import { NodePath } from '@babel/traverse';
import { TransformState } from '../state/types';
import * as t from '@babel/types';
import { trackLabeledStatement } from '../transform/tracking/trackLabeledStatement';

/**
 * Process labeled statement:
 * - T: while (true) { break T; }
 */
export function processLabeledStatement(
  path: NodePath<t.LabeledStatement>,
  state: TransformState
): void {
  trackLabeledStatement(state.importTracker.scopeTracker, path.node);
}
