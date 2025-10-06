import { ScopeTracker } from '../../state/ScopeTracker';
import * as t from '@babel/types';
import { trackOverridingVariable } from './trackOverridingVariable';

/**
 * Track function declaration:
 * - function T() { ... }
 */
export function trackFunctionDeclaration(
  scopeTracker: ScopeTracker,
  functionDeclaration: t.FunctionDeclaration
): void {
  const functionName = functionDeclaration.id?.name;
  if (functionName === undefined) {
    return;
  }
  trackOverridingVariable(functionName, scopeTracker);
}
