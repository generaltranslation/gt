import { TransformState } from '../state/types';
import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { trackForDeclaration } from '../transform/tracking/trackForDeclaration';

/**
 * Process for of statement:
 * - for(let T of items) { ... }
 */
export function processForOfStatement(
  path: NodePath<t.ForOfStatement>,
  state: TransformState
): void {
  trackForDeclaration(state.importTracker.scopeTracker, path.node);
}
