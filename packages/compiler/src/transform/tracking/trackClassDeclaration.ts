import { ScopeTracker } from '../../state/ScopeTracker';
import * as t from '@babel/types';
import { trackOverridingVariable } from './trackOverridingVariable';

/**
 * Track class declaration:
 * - class T { ... }
 */
export function trackClassDeclaration(
  scopeTracker: ScopeTracker,
  classDeclaration: t.ClassDeclaration
): void {
  const className = classDeclaration.id?.name;
  if (!className) {
    return;
  }
  trackOverridingVariable(className, scopeTracker);
}
