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
      state.importTracker.enterScope();
      trackFunctionParams(path.node.params, state.importTracker.scopeTracker);
    },
    exit() {
      state.importTracker.exitScope();
    },
  };
}
