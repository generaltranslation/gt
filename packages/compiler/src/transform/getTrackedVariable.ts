import { ImportTracker } from '../state/ImportTracker';
import { VariableType } from '../state/ScopeTracker';

/**
 * Given state, namespace, and functionname, return:
 * - canonicalName
 * - identifier
 * - type
 */
export function getTrackedVariable(
  importTracker: ImportTracker,
  namespaceName: string | null,
  functionName: string | null
): {
  canonicalName: string | undefined;
  identifier: number | undefined;
  type: VariableType | undefined;
} {
  if (!functionName) {
    return {
      canonicalName: undefined,
      identifier: undefined,
      type: undefined,
    };
  }

  // If namespace, no alias resolution needed
  if (namespaceName) {
    if (!importTracker.namespaceImports.has(namespaceName))
      return {
        canonicalName: undefined,
        identifier: undefined,
        type: undefined,
      };
    return {
      canonicalName: functionName,
      identifier: undefined,
      type: 'generaltranslation', // TODO: revisit this when we add support for multiple namespaces
    };
  }

  // Resolve aliased function name
  const variable = importTracker.scopeTracker.getVariable(functionName);
  return {
    canonicalName: variable?.canonicalName ?? undefined,
    identifier: variable?.identifier ?? undefined,
    type: variable?.type ?? undefined,
  };
}
