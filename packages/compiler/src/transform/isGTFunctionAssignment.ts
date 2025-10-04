import { TransformState } from '../state/types';
import { GT_CALLBACK_FUNCTIONS } from '../utils/constants/gt/constants';

/**
 * Determine if the function assignment is a GT function assignment
 * @param namespaceName - The namespace name if it exists
 * @param functionName - The function name
 * @param state - The transform state
 * @returns True if the function assignment is a GT function assignment, false otherwise
 *
 * const t = namespaceName.functionName()
 *
 * const t = useGT() => true
 * const t = useMessages() => true
 * const t = msg() => false (msg() does not return a callback)
 * const t = someFunction() => false
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
  let canonicalFunctionName: string | null = null;
  if (namespaceName) {
    if (!state.importTracker.namespaceImports.has(namespaceName)) return false;
    // If member function, no alias resolution needed
    canonicalFunctionName = functionName;
  } else {
    // resolve aliased function name
    canonicalFunctionName =
      state.importTracker.scopeTracker.getTranslationVariable(functionName)
        ?.canonicalName ?? null;
  }

  // Check that this is a valid GT function callback
  if (
    !Object.values(GT_CALLBACK_FUNCTIONS).includes(
      `${canonicalFunctionName}_callback` as GT_CALLBACK_FUNCTIONS
    )
  ) {
    return false;
  }

  return true;
}
