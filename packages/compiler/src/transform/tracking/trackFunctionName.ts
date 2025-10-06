import { ScopeTracker } from '../../state/ScopeTracker';
import * as t from '@babel/types';
import { trackOverridingVariable } from './trackOverridingVariable';

/**
 * Track function declaration:
 * - function T() { ... }
 */
export function trackFunctionName(
  scopeTracker: ScopeTracker,
  functionDeclaration: t.FunctionExpression
): void;
export function trackFunctionName(
  scopeTracker: ScopeTracker,
  functionDeclaration: t.FunctionDeclaration
): void;
export function trackFunctionName(
  scopeTracker: ScopeTracker,
  functionDeclaration: t.FunctionDeclaration | t.FunctionExpression
): void {
  const functionName = functionDeclaration.id?.name;
  if (functionName === undefined) {
    return;
  }
  trackOverridingVariable(functionName, scopeTracker);
}
