import { VisitNode } from '@babel/traverse';
import { TransformState } from '../state/types';
import * as t from '@babel/types';
import { trackFunctionParams } from '../transform/tracking/trackFunctionParams';

/**
 * Process object method:
 * - { T() {} } in objects
 *
 */
export function processObjectMethod(
  state: TransformState
): VisitNode<t.Node, t.ObjectMethod> {
  return {
    enter(path) {
      // Function name is not relevant for object methods
      state.scopeTracker.enterScope();
      trackFunctionParams(path.node.params, state.scopeTracker);
    },
    exit() {
      state.scopeTracker.exitScope();
    },
  };
}
