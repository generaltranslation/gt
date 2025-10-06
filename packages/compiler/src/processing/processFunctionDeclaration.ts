import { TransformState } from '../state/types';
import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { trackFunctionDeclaration } from '../transform/tracking/trackFunctionDeclaration';

/**
 * Process function declaration:
 * - function T() { ... }
 */
export function processFunctionDeclaration(
  path: NodePath<t.FunctionDeclaration>,
  state: TransformState
): void {
  trackFunctionDeclaration(state.importTracker.scopeTracker, path.node);
}
