import { VisitNode } from '@babel/traverse';
import { TransformState } from '../state/types';
import * as t from '@babel/types';

/**
 * Generic processing function for scope changes
 */
export function processScopeChange(
  state: TransformState
): VisitNode<t.Node, t.Node> {
  return {
    enter() {
      state.scopeTracker.enterScope();
    },
    exit() {
      state.scopeTracker.exitScope();
    },
  };
}
