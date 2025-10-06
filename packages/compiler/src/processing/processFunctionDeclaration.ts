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
      trackFunctionName(state.importTracker.scopeTracker, path.node);
      state.importTracker.enterScope();
      trackFunctionParams(path.node.params, state.importTracker.scopeTracker);
    },
    exit() {
      state.importTracker.exitScope();
    },
  };
}
