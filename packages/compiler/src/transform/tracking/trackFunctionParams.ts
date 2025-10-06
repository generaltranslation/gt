import * as t from '@babel/types';
import { ScopeTracker } from '../../state/ScopeTracker';
import { trackOverridingVariable } from './trackOverridingVariable';
import { extractIdentifiersFromLVal } from '../../utils/jsx/extractIdentifiersFromLVal';

/**
 * Track overriding function parameters
 * function (useGT, useMessages) {...}
 * (useGT, useMessages) => {...}
 */
export function trackFunctionParams(
  params: (t.FunctionParameter | t.TSParameterProperty)[],
  scopeTracker: ScopeTracker
): void {
  for (const param of params) {
    // Ignore non-LVal parameters
    if (!t.isLVal(param)) {
      continue;
    }

    // We know that all of these are overriding variables
    const identifiers = extractIdentifiersFromLVal(param);
    for (const identifier of identifiers) {
      trackOverridingVariable(identifier, scopeTracker);
    }
  }
}
