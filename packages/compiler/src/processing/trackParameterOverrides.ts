import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { ScopeTracker } from '../state/ScopeTracker';
import { trackFunctionParams } from '../transform/tracking/trackFunctionParams';

/**
 * Track function parameter overrides that could shadow variables
 * function (useGT, useMessages) {...}
 * @deprecated
 */
export function trackParameterOverrides(
  path: NodePath<t.Function>,
  scopeTracker: ScopeTracker
): void {
  const func = path.node;
  const params = func.params || [];
  trackFunctionParams(params, scopeTracker);
}
