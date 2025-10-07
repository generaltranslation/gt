import { VisitNode } from '@babel/traverse';
import { TransformState } from '../state/types';
import * as t from '@babel/types';
import { trackForDeclaration } from '../transform/tracking/trackForDeclaration';

/**
 * Process for in statement:
 * - for(let T in obj) { ... }
 */
export function processForInStatement(
  state: TransformState
): VisitNode<t.Node, t.ForInStatement> {
  return {
    enter(path) {
      state.scopeTracker.enterScope();
      trackForDeclaration(state.scopeTracker, path.node);
    },
    exit() {
      state.scopeTracker.exitScope();
    },
  };
}
