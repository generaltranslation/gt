import { TransformState } from '../state/types';
import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { trackLabeledStatement } from '../transform/tracking/trackLabeledStatement';

export function processLabeledStatement(
  state: TransformState
): VisitNode<t.Node, t.LabeledStatement> {
  return {
    enter(path) {
      trackLabeledStatement(state.scopeTracker, path.node);
    },
  };
}
