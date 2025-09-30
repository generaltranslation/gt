import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { TransformState } from '../../state/types';
import { extractIdentifiersFromLVal } from '../../utils/extractIdentifiersFromLVal';
import { GT_CALLBACK_FUNCTIONS } from '../../utils/constants/constants';
import { trackOverridingVariable } from './trackOverridingVariable';

/**
 * Track variable assignments like: const t = useGT()
 */
export function trackVariableAssignment(
  path: NodePath<t.VariableDeclarator>,
  state: TransformState
): void {
  const varDeclarator = path.node;

  // Ignore non-LVal assignments
  if (!t.isLVal(varDeclarator.id)) {
    return;
  }

  // Get the Expression invocation to check if its a GT function call: ... = useGT();
  const { namespaceName, functionName } = getCalleeNameFromExpression(
    varDeclarator.init
  );

  // Determine if this is a gt function assignment
  const isGTFunctionAssignment = determineIsGTFunctionAssignment(
    namespaceName,
    functionName,
    state
  );

  // Extract identifiers from the LVal
  const identifiers = extractIdentifiersFromLVal(varDeclarator.id);

  // Add tracking for identifiers
  for (const identifier of identifiers) {
    if (isGTFunctionAssignment) {
      // Increment the counter
      const counterId = state.stringCollector.incrementCounter();

      // Resolve the canonical function name (functionName is not null from determineIsGTFunctionAssignment)
      const canonicalFunctionName =
        state.importTracker.scopeTracker.getTranslationVariable(functionName!)
          ?.canonicalName ?? null;

      // Track as a callback variable
      state.importTracker.scopeTracker.trackTranslationCallbackVariable(
        identifier,
        GT_CALLBACK_FUNCTIONS[
          `${canonicalFunctionName}_callback` as keyof typeof GT_CALLBACK_FUNCTIONS
        ],
        counterId
      );
    } else {
      // Track as an overriding variable
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

  // If its an await expression, unwrap it
  if (t.isAwaitExpression(expr)) {
    return getCalleeNameFromExpression(expr.argument);
  }

  // Check that this is a call expression eg: func()
  if (!t.isCallExpression(expr)) {
    return { namespaceName: null, functionName: null };
  }

  // Get the callee name
  const calleeName = expr.callee;

  // Simple case: ... = useGT();
  if (t.isIdentifier(calleeName)) {
    return { namespaceName: null, functionName: calleeName.name };
  }

  // Member expression: ... = GT.useGT();
  if (t.isMemberExpression(calleeName)) {
    if (
      t.isIdentifier(calleeName.object) &&
      t.isIdentifier(calleeName.property)
    ) {
      return {
        namespaceName: calleeName.object.name,
        functionName: calleeName.property.name,
      };
    }
  }

  return { namespaceName: null, functionName: null };
}

/**
 * Determine if the function assignment is a GT function assignment
 */
function determineIsGTFunctionAssignment(
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
