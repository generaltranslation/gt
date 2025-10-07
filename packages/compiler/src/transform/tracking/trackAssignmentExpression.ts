import { ScopeTracker } from '../../state/ScopeTracker';
import * as t from '@babel/types';
import { trackOverridingVariable } from './trackOverridingVariable';
import { extractIdentifiersFromLVal } from '../../utils/parsing/extractIdentifiersFromLVal';

/**
 * Track assignment expressions
 * - let t = useGT(); t = undefined;
 */
export function trackAssignmentExpression(
  scopeTracker: ScopeTracker,
  assignmentExpression: t.AssignmentExpression
): void {
  if (t.isOptionalMemberExpression(assignmentExpression.left)) {
    handleOptionalMemberExpression(scopeTracker, assignmentExpression.left);
  } else if (t.isLVal(assignmentExpression.left)) {
    handleLVal(scopeTracker, assignmentExpression.left);
  }
}

/**
 * Handle optional member expressions
 * import GT from 'gt-next';
 * GT.T = undefined;
 * TODO: track overwritten variable when handling namespace imports is refactored
 */
function handleOptionalMemberExpression(
  scopeTracker: ScopeTracker,
  optionalMemberExpression: t.OptionalMemberExpression
): void {
  return;
}

/**
 * Handle LVal expressions
 * T = undefined;
 */
function handleLVal(scopeTracker: ScopeTracker, lVal: t.LVal): void {
  const identifiers = extractIdentifiersFromLVal(lVal);
  for (const identifier of identifiers) {
    trackOverridingVariable(identifier, scopeTracker);
  }
}
