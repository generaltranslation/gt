import { ScopeTracker } from '../../state/ScopeTracker';
import * as t from '@babel/types';
import { trackOverridingVariable } from './trackOverridingVariable';
import { extractIdentifiersFromLVal } from '../../utils/jsx/extractIdentifiersFromLVal';

/**
 * Track for statement:
 * - for(T of items) { ... }
 * - for(T in obj) { ... }
 */
export function trackForDeclaration(
  scopeTracker: ScopeTracker,
  forOfStatement: t.ForOfStatement | t.ForInStatement
): void {
  // Variable declaration is already handled in processVariableAssignment
  if (t.isVariableDeclaration(forOfStatement.left)) {
    return;
  }
  // Extract identifiers from the LVal
  const identifiers = extractIdentifiersFromLVal(forOfStatement.left);

  // Track any overriding variables
  for (const identifier of identifiers) {
    trackOverridingVariable(identifier, scopeTracker);
  }
}
