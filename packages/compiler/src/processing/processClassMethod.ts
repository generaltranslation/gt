import { TransformState } from '../state/types';
import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { trackClassMethod } from '../transform/tracking/trackClassMethod';
/**
 * Process class method:
 * - class T { T() { ... } }
 */
export function processClassMethod(
  path: NodePath<t.ClassMethod>,
  state: TransformState
): void {
  trackClassMethod(state.importTracker.scopeTracker, path.node);
}
