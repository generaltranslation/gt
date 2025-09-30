import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { TransformState } from '../types';
import { trackImportDeclaration } from './trackImportDeclaration';


/**
 * Process import declarations to track GT imports
 * Ported from Rust: process_gt_import_declaration (lines 252-299)
 */
export function processImportDeclaration(
  path: NodePath<t.ImportDeclaration>,
  state: TransformState
): void {
  trackImportDeclaration(
    state.importTracker.scopeTracker,
    path.node.source.value,
    path.node
  );  
}