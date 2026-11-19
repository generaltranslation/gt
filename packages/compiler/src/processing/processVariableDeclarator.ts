import { TransformState } from '../state/types';
import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { trackVariableDeclarator } from '../transform/tracking/trackVariableDeclarator';

/**
 * Process variable declarations to track variables that shadow GT imports
 * - const T = "Hello"
 */
export function processVariableDeclarator(
  state: TransformState
): VisitNode<t.Node, t.VariableDeclarator> {
  return (path) => {
    trackVariableDeclarator(path.node, state);
  };
}
