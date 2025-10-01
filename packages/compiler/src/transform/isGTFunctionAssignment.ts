import { TransformState } from '../state/types';
import { GT_CALLBACK_FUNCTIONS } from '../utils/constants/constants';

/**
 * Determine if the function assignment is a GT function assignment
 */
export function isGTFunctionAssignment(
  namespaceName: string | null,
  functionName: string | null,
  state: TransformState
): boolean {
  // If there is no function name, its not a GT function assignment
  if (!functionName) {
    return false;
  }

  // Check if the namespace is a GT namespace
  if (
    namespaceName &&
    !state.importTracker.namespaceImports.has(namespaceName)
  ) {
    return false;
  }

  // Check if the function is a function we want to track callbacks for: useGT, useMessages, etc.
  const canonicalFunctionName =
    state.importTracker.scopeTracker.getTranslationVariable(functionName)
      ?.canonicalName ?? null;
  if (
    !Object.values(GT_CALLBACK_FUNCTIONS).includes(
      `${canonicalFunctionName}_callback` as GT_CALLBACK_FUNCTIONS
    )
  ) {
    return false;
  }

  return true;
}
