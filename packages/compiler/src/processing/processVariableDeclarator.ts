import { TransformState } from '../state/types';
import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { getCalleeNameFromExpression as _getCalleeNameFromExpression } from '../utils/jsx/getCalleeNameFromExpression';
import { extractIdentifiersFromLVal } from '../utils/jsx/extractIdentifiersFromLVal';
import { trackOverridingVariable } from '../transform/tracking/trackOverridingVariable';
import { GT_FUNCTIONS_TO_CALLBACKS } from '../utils/constants/gt/constants';
import { isGTFunctionWithCallbacks } from '../utils/constants/gt/helpers';
import { getCanonicalFunctionName } from '../transform/getCanonicalFunctionName';
import { ImportTracker } from '../state/ImportTracker';

/**
 * Process variable assignments.
 * - Track callback variables (via translation function invocations: useGT, useTranslations, useMessages, etc.)
 * - Track overriding variables
 *
 * GT callbacks:
 * - const gt = useGT()
 *
 * Overriding variables:
 * - const gt = msg("hello");
 * - const gt = "Hello"
 */
export function processVariableAssignment(
  path: NodePath<t.VariableDeclarator>,
  state: TransformState
): void {
  const varDeclarator = path.node;

  // Ignore non-LVal assignments
  if (!t.isLVal(varDeclarator.id)) {
    return;
  }

  // Get function name from callee
  const { namespaceName, functionName } = getCalleeNameFromExpression(
    varDeclarator.init
  );
  if (!functionName) {
    return;
  }

  // Get the canonical function name
  const canonicalFunctionName = getCanonicalFunctionName(
    state,
    namespaceName,
    functionName
  );

  // Extract identifiers from the LVal
  const identifiers = extractIdentifiersFromLVal(varDeclarator.id);

  // Track:
  // (1) GT callback functions
  // (2) Variables with overriding names
  if (
    canonicalFunctionName &&
    isGTFunctionWithCallbacks(canonicalFunctionName)
  ) {
    // Track GT functions with callbacks (useGT, useTranslations, useMessages, etc.)
    const callbackFunctionName =
      GT_FUNCTIONS_TO_CALLBACKS[canonicalFunctionName];

    // Increment the counter
    const counterId = state.stringCollector.incrementCounter();

    // Track as a callback variables
    for (const identifier of identifiers) {
      state.importTracker.scopeTracker.trackTranslationCallbackVariable(
        identifier,
        callbackFunctionName,
        counterId
      );
    }
  } else {
    // Track as an overriding variable
    for (const identifier of identifiers) {
      trackOverridingVariable(identifier, state.importTracker.scopeTracker);
    }
  }
}

/* =============================== */
/* Handlers */
/* =============================== */

/**
 * Get the callee name from an expression: ... = useGT();
 */
function getCalleeNameFromExpression(expr: t.Expression | null | undefined): {
  namespaceName: string | null;
  functionName: string | null;
} {
  if (!expr) {
    return { namespaceName: null, functionName: null };
  }
  return _getCalleeNameFromExpression(expr);
}

/**
 * Given a functionName, return true if it is a GT function that has been imported (not just checking the name)
 */
function isGTFunction(
  functionName: string,
  namespaceName: string | null,
  importTracker: ImportTracker
): boolean {
  if (!functionName) {
    return false;
  }

  // If namespace, no alias resolution needed
  // TODO: when we add support for multiple namespaces, we will have to revisit this and only check the namespace
  if (namespaceName) {
    if (!importTracker.namespaceImports.has(namespaceName)) return false;
    return true;
  }

  // Resolve aliased function name
  return !!importTracker.scopeTracker.getTranslationVariable(functionName);
}
