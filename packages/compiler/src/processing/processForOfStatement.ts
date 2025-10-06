import { TransformState } from '../state/types';
import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { trackForDeclaration } from '../transform/tracking/trackForDeclaration';

/**
 * Process for of statement:
 * - for(let T of items) { ... }
 */
export function processForOfStatement(
  state: TransformState
): VisitNode<t.Node, t.ForOfStatement> {
  return {
    enter(path) {
      state.importTracker.enterScope();
      trackForDeclaration(state.importTracker.scopeTracker, path.node);
    },
    exit() {
      state.importTracker.exitScope();
    },
  };
}
