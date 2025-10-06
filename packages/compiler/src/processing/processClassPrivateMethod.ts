import { TransformState } from '../state/types';
import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { trackFunctionParams } from '../transform/tracking/trackFunctionParams';

/**
 * Process class private method:
 * - class GT { #T() {...} }
 */
export function processClassPrivateMethod(
  state: TransformState
): VisitNode<t.Node, t.ClassPrivateMethod> {
  return {
    enter(path) {
      // Function name is not relevant for class private methods
      state.importTracker.enterScope();
      trackFunctionParams(path.node.params, state.importTracker.scopeTracker);
    },
    exit() {
      state.importTracker.exitScope();
    },
  };
}
