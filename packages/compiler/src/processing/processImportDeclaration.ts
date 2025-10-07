import * as t from '@babel/types';
import { VisitNode } from '@babel/traverse';
import { TransformState } from '../state/types';
import { trackImportDeclaration } from '../transform/tracking/trackImportDeclaration';

/**
 * Process import declarations to track GT imports
 */
export function processImportDeclaration(
  state: TransformState
): VisitNode<t.Node, t.ImportDeclaration> {
  return (path) => {
    trackImportDeclaration(state.scopeTracker, path.node);
  };
}
