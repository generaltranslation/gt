import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { trackFunctionParams } from '../transform/tracking/trackFunctionParams';
import { TransformState } from '../state/types';

/**
 * Track arrow function parameter overrides
 * (useGT, useMessages) => {...}
 */
export function processArrowFunctionExpression(
  state: TransformState
): VisitNode<t.Node, t.ArrowFunctionExpression> {
  return {
    enter(path) {
      state.scopeTracker.enterScope();
      trackFunctionParams(path.node.params, state.scopeTracker);
    },
    exit() {
      state.scopeTracker.exitScope();
    },
  };
}
