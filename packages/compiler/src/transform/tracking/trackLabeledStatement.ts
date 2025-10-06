import { ScopeTracker } from '../../state/ScopeTracker';
import * as t from '@babel/types';
import { trackOverridingVariable } from './trackOverridingVariable';

/**
 * Track labeled statement:
 * - T: while (true) { break T; }
 */
export function trackLabeledStatement(
  scopeTracker: ScopeTracker,
  labeledStatement: t.LabeledStatement
): void {
  const label = labeledStatement.label.name;
  trackOverridingVariable(label, scopeTracker);
}
