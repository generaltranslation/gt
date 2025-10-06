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
      state.importTracker.enterScope();
      trackFunctionParams(path.node.params, state.importTracker.scopeTracker);
    },
    exit() {
      state.importTracker.exitScope();
    },
  };
}
