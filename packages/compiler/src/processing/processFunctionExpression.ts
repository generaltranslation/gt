import { VisitNode } from '@babel/traverse';
import { TransformState } from '../state/types';
import * as t from '@babel/types';
import { trackFunctionParams } from '../transform/tracking/trackFunctionParams';
import { trackFunctionName } from '../transform/tracking/trackFunctionName';

/**
 * Process function expression:
 * - function () { ... }
 *
 * Why two enter/exit scopes?
 * - This is because function name is only relevant for function body
 * - This is because parameters can override the function name
 */
export function processFunctionExpression(
  state: TransformState
): VisitNode<t.Node, t.FunctionExpression> {
  return {
    enter(path) {
      state.scopeTracker.enterScope();
      trackFunctionName(state.scopeTracker, path.node);
      state.scopeTracker.enterScope();
      trackFunctionParams(path.node.params, state.scopeTracker);
    },
    exit() {
      state.scopeTracker.exitScope();
      state.scopeTracker.exitScope();
    },
  };
}
