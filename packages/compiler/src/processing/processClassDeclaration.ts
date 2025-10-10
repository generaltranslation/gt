import { VisitNode } from '@babel/traverse';
import { TransformState } from '../state/types';
import * as t from '@babel/types';
import { trackClassDeclaration } from '../transform/tracking/trackClassDeclaration';

/**
 * Process class declaration:
 * - class T { ... }
 */
export function processClassDeclaration(
  state: TransformState
): VisitNode<t.Node, t.ClassDeclaration> {
  return {
    enter(path) {
      trackClassDeclaration(state.scopeTracker, path.node);
      state.scopeTracker.enterScope();
    },
    exit() {
      state.scopeTracker.exitScope();
    },
  };
}
