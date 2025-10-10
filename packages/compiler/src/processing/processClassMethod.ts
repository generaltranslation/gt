import { TransformState } from '../state/types';
import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { trackFunctionParams } from '../transform/tracking/trackFunctionParams';
/**
 * Process class method:
 * - class T { T() { ... } }
 */
export function processClassMethod(
  state: TransformState
): VisitNode<t.Node, t.ClassMethod> {
  return {
    enter(path) {
      // Function name is not relevant for class methods
      state.scopeTracker.enterScope();
      trackFunctionParams(path.node.params, state.scopeTracker);
    },
    exit() {
      state.scopeTracker.exitScope();
    },
  };
}
