import { ScopeTracker } from '../../state/ScopeTracker';
import * as t from '@babel/types';
import { trackOverridingVariable } from './trackOverridingVariable';

/**
 * Track class method:
 * - class T { T() { ... } }
 */
export function trackClassMethod(
  scopeTracker: ScopeTracker,
  classMethod: t.ClassMethod
): void {
  const methodName = getMethodName(classMethod.key);
  if (methodName === undefined) {
    return;
  }
  trackOverridingVariable(methodName, scopeTracker);
}

function getMethodName(key: t.ClassMethod['key']): string | undefined {
  if (t.isIdentifier(key)) {
    return key.name;
  } else if (t.isStringLiteral(key)) {
    return key.value;
  }
  return undefined;
}
