import { NodePath } from '@babel/traverse';
import { TransformState } from '../state/types';
import * as t from '@babel/types';
import { trackForDeclaration } from '../transform/tracking/trackForDeclaration';

/**
 * Process for in statement:
 * - for(let T in obj) { ... }
 */
export function processForInStatement(
  path: NodePath<t.ForInStatement>,
  state: TransformState
): void {
  trackForDeclaration(state.importTracker.scopeTracker, path.node);
}
