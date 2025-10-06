import { NodePath } from '@babel/traverse';
import { TransformState } from '../state/types';
import * as t from '@babel/types';
import { trackObjectMethod } from '../transform/tracking/trackObjectMethod';

/**
 * Process object method:
 * - { T() {} } in objects
 */
export function processObjectMethod(
  path: NodePath<t.ObjectMethod>,
  state: TransformState
): void {
  trackObjectMethod(state.importTracker.scopeTracker, path.node);
}
