import { ScopeTracker } from '../state/ScopeTracker';
import { VariableType } from '../state/ScopeTracker';

/**
 * Given state, namespace, and functionname, return:
 * - canonicalName
 * - type
 */
export function getTrackedVariable(
  scopeTracker: ScopeTracker,
  namespaceName: string | null,
  functionName: string | null
): {
  canonicalName: string | undefined;
  type: VariableType | undefined;
} {
  if (!functionName) {
    return {
      canonicalName: undefined,
      type: undefined,
    };
  }

  // If namespace, no alias resolution needed
  if (namespaceName) {
    if (!scopeTracker.hasNamespaceImport(namespaceName)) {
      return {
        canonicalName: undefined,
        type: undefined,
      };
    }
    return {
      canonicalName: functionName,
      type: 'generaltranslation', // TODO: revisit this when we add support for multiple namespaces
    };
  }

  // Resolve aliased function name
  const variable = scopeTracker.getVariable(functionName);
  return {
    canonicalName: variable?.canonicalName ?? undefined,
    type: variable?.type ?? undefined,
  };
}
