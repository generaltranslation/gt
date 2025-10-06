import { TransformState } from '../../state/types';
import * as t from '@babel/types';
import { extractIdentifiersFromLVal } from '../../utils/jsx/extractIdentifiersFromLVal';
import { trackOverridingVariable } from '../../transform/tracking/trackOverridingVariable';
import { GT_FUNCTIONS_TO_CALLBACKS } from '../../utils/constants/gt/constants';
import { isGTFunctionWithCallbacks } from '../../utils/constants/gt/helpers';
import { getTrackedVariable } from '../getTrackedVariable';
import { getCalleeNameFromExpressionWrapper } from '../../utils/getCalleeNameFromExpressionWrapper';

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
    return;
  }

  // Get the canonical function name
  const { canonicalName, type } = getTrackedVariable(
    state.importTracker,
    namespaceName,
    functionName
  );
  if (!canonicalName) {
    return;
  }

  // Extract identifiers from the LVal
  const identifiers = extractIdentifiersFromLVal(varDeclarator.id);

  // Track:
  // (1) GT callback functions
  // (2) Variables with overriding names
  if (
    type === 'generaltranslation' &&
    isGTFunctionWithCallbacks(canonicalName)
  ) {
    // Track GT functions with callbacks (useGT, useTranslations, useMessages, etc.)
    const callbackFunctionName = GT_FUNCTIONS_TO_CALLBACKS[canonicalName];

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
