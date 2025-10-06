import { ScopeTracker } from '../../state/ScopeTracker';
import * as t from '@babel/types';
import { trackOverridingVariable } from './trackOverridingVariable';
/**
 * Track object method:
 * - { T() {} } in objects
 */
export function trackObjectMethod(
  scopeTracker: ScopeTracker,
  objectMethod: t.ObjectMethod
): void {
  const methodName = getMethodName(objectMethod.key);
  if (methodName === undefined) {
    return;
  }
  trackOverridingVariable(methodName, scopeTracker);
}

function getMethodName(key: t.ObjectMethod['key']): string | undefined {
  if (t.isIdentifier(key)) {
    return key.name;
  } else if (t.isStringLiteral(key)) {
    return key.value;
  }
  return undefined;
}
