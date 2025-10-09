import { TransformState } from '../../state/types';
import * as t from '@babel/types';
import { extractIdentifiersFromLVal } from '../../utils/parsing/extractIdentifiersFromLVal';
import { GT_FUNCTIONS_TO_CALLBACKS } from '../../utils/constants/gt/constants';
import { isGTFunctionWithCallbacks } from '../../utils/constants/gt/helpers';
import { getTrackedVariable } from '../getTrackedVariable';
import { getCalleeNameFromExpressionWrapper } from '../../utils/parsing/getCalleeNameFromExpressionWrapper';
import { createErrorLocation } from '../../utils/errors';
import { ScopeTracker } from '../../state/ScopeTracker';

/**
 * Track variable assignments.
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
export function trackVariableDeclarator(
  varDeclarator: t.VariableDeclarator,
  state: TransformState
): void {
  // Ignore non-LVal assignments
  if (!t.isLVal(varDeclarator.id)) {
    return;
  }

  // Get function name from callee
  const { namespaceName, functionName } = getCalleeNameFromExpressionWrapper(
    varDeclarator.init
  );
  if (!functionName) {
    handleOverridingVariable(
      varDeclarator as t.VariableDeclarator & { id: t.LVal },
      state.scopeTracker
    );
    return;
  }

  // Get the canonical function name
  const { canonicalName, type } = getTrackedVariable(
    state.scopeTracker,
    namespaceName,
    functionName
  );
  if (!canonicalName) {
    handleOverridingVariable(
      varDeclarator as t.VariableDeclarator & { id: t.LVal },
      state.scopeTracker
    );
    return;
  }

  // Track:
  // (1) GT callback functions
  // (2) Variables with overriding names
  if (
    type !== 'generaltranslation' ||
    !isGTFunctionWithCallbacks(canonicalName)
  ) {
    handleOverridingVariable(
      varDeclarator as t.VariableDeclarator & { id: t.LVal },
      state.scopeTracker
    );
    return;
  }

  // Extract identifiers from the LVal
  const identifiers = extractIdentifiersFromLVal(varDeclarator.id);

  // Track GT functions with callbacks (useGT, useTranslations, useMessages, etc.)
  const callbackFunctionName = GT_FUNCTIONS_TO_CALLBACKS[canonicalName];

  // There can only be one callback defined for const gt = useGT()
  if (identifiers.length !== 1) {
    state.errorTracker.addError(
      'Multiple identifiers found for GT function with callbacks: ${canonicalName}. Variable tracking failed.' +
        createErrorLocation(varDeclarator.id)
    );
    return;
  }
  const identifier = identifiers[0];

  // Increment the counter
  const counterId = state.stringCollector.incrementCounter();

  // Track as a callback variables
  state.scopeTracker.trackTranslationCallbackVariable(
    identifier,
    callbackFunctionName,
    counterId
  );
}

/* =============================== */
/* Helper Functions */
/* =============================== */

function handleOverridingVariable(
  varDeclarator: t.VariableDeclarator & { id: t.LVal },
  scopeTracker: ScopeTracker
): void {
  // Extract identifiers from the LVal
  const identifiers = extractIdentifiersFromLVal(varDeclarator.id);

  // Track as an overriding variable
  for (const identifier of identifiers) {
    scopeTracker.trackRegularVariable(identifier, 'other');
  }
}
