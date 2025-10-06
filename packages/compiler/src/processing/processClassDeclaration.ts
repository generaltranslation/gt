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
      trackClassDeclaration(state.importTracker.scopeTracker, path.node);
      state.importTracker.enterScope();
    },
    exit() {
      state.importTracker.exitScope();
    },
  };
}
