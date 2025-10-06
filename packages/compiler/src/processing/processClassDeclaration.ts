import { NodePath } from '@babel/traverse';
import { TransformState } from '../state/types';
import * as t from '@babel/types';
import { trackClassDeclaration } from '../transform/tracking/trackClassDeclaration';

/**
 * Process class declaration:
 * - class T { ... }
 */
export function processClassDeclaration(
  path: NodePath<t.ClassDeclaration>,
  state: TransformState
): void {
  trackClassDeclaration(state.importTracker.scopeTracker, path.node);
}
