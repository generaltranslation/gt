import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { TransformState } from '../state/types';
import { trackImportDeclaration } from '../transform/tracking/trackImportDeclaration';

/**
 * Process import declarations to track GT imports
 */
export function processImportDeclaration(
  path: NodePath<t.ImportDeclaration>,
  state: TransformState
): void {
  trackImportDeclaration(state.importTracker.scopeTracker, path.node);
}
