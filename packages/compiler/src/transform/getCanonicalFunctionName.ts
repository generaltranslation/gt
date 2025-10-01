import { ImportTracker } from '../state/ImportTracker';

/**
 * Given state, namespace, and functionname, return the canonical function name
 */
export function getCanonicalFunctionName(
  importTracker: ImportTracker,
  namespaceName: string | null,
  functionName: string | null
): string | undefined {
  if (!functionName) {
    return undefined;
  }

  // If namespace, no alias resolution needed
  if (namespaceName) {
    if (!importTracker.namespaceImports.has(namespaceName)) return undefined;
    return functionName;
  }

  // Resolve aliased function name
  return (
    importTracker.scopeTracker.getVariable(functionName)?.canonicalName ??
    undefined
  );
}
