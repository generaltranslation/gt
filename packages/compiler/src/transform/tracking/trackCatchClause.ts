import { ScopeTracker } from '../../state/ScopeTracker';
import * as t from '@babel/types';
import { extractIdentifiersFromLVal } from '../../utils/jsx/extractIdentifiersFromLVal';
import { trackOverridingVariable } from './trackOverridingVariable';

/**
 * Track catch clause:
 * - catch(T) { ... }
 */
export function trackCatchClause(
  scopeTracker: ScopeTracker,
  catchClause: t.CatchClause
): void {
  if (t.isLVal(catchClause.param)) {
    const identifiers = extractIdentifiersFromLVal(catchClause.param);
    for (const identifier of identifiers) {
      trackOverridingVariable(identifier, scopeTracker);
    }
  }
}
