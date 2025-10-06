import { TransformState } from '../state/types';
import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { trackCatchClause } from '../transform/tracking/trackCatchClause';

/**
 * Process catch clause:
 * - catch(T) { ... }
 */
export function processCatchClause(
  path: NodePath<t.CatchClause>,
  state: TransformState
): void {
  trackCatchClause(state.importTracker.scopeTracker, path.node);
}
