import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { TransformState } from '../../state/types';
import { extractIdentifiersFromLVal } from '../../utils/jsx/extractIdentifiersFromLVal';
import { GT_CALLBACK_FUNCTIONS } from '../../utils/constants/constants';
import { trackOverridingVariable } from './trackOverridingVariable';
import { getCalleeNameFromExpression as _getCalleeNameFromExpression } from '../../utils/jsx/getCalleeNameFromExpression';
import { isGTFunctionAssignment } from '../isGTFunctionAssignment';

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
  const gtFunctionAssignment = isGTFunctionAssignment(
    namespaceName,
    functionName,
    state
  );

  // Extract identifiers from the LVal
  const identifiers = extractIdentifiersFromLVal(varDeclarator.id);

  // Add tracking for identifiers
  for (const identifier of identifiers) {
    if (gtFunctionAssignment) {
      // Increment the counter
      const counterId = state.stringCollector.incrementCounter();

      // Resolve the canonical function name (functionName is not null from isGTFunctionAssignment)
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
  return _getCalleeNameFromExpression(expr);
}
