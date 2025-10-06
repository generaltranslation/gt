import { TransformState } from '../state/types';
import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { trackCatchClause } from '../transform/tracking/trackCatchClause';

/**
 * Process catch clause:
 * - catch(T) { ... }
 */
export function processCatchClause(
  state: TransformState
): VisitNode<t.Node, t.CatchClause> {
  return {
    enter(path) {
      state.importTracker.enterScope();
      trackCatchClause(state.importTracker.scopeTracker, path.node);
    },
    exit() {
      state.importTracker.exitScope();
    },
  };
}
