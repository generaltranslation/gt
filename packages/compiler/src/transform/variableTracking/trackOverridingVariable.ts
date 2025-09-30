import { ScopeTracker } from '../../visitor/scope-tracker';

/**
 * Track overriding variables (ones that shadow existing GT imports)
 */
export function trackOverridingVariable(
  variableName: string,
  scopeTracker: ScopeTracker
): void {
  // Only track variables that override existing variables
  if (!scopeTracker.getVariable(variableName)) {
    return;
  }

  // Add tracking for the variable
  scopeTracker.trackRegularVariable(variableName, 'other');
}
