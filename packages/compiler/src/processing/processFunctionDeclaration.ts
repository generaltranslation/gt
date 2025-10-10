import { TransformState } from '../state/types';
import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { trackFunctionName } from '../transform/tracking/trackFunctionName';
import { trackFunctionParams } from '../transform/tracking/trackFunctionParams';

/**
 * Process function declaration:
 * - function T() { ... }
 */
export function processFunctionDeclaration(
  state: TransformState
): VisitNode<t.Node, t.FunctionDeclaration> {
  return {
    enter(path) {
      trackFunctionName(state.scopeTracker, path.node);
      state.scopeTracker.enterScope();
      trackFunctionParams(path.node.params, state.scopeTracker);
    },
    exit() {
      state.scopeTracker.exitScope();
    },
  };
}
