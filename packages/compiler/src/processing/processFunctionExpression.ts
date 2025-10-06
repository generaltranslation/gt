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
      state.importTracker.enterScope();
      trackFunctionName(state.importTracker.scopeTracker, path.node);
      state.importTracker.enterScope();
      trackFunctionParams(path.node.params, state.importTracker.scopeTracker);
    },
    exit() {
      state.importTracker.exitScope();
      state.importTracker.exitScope();
    },
  };
}
