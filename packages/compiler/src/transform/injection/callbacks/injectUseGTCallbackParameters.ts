import { TransformState } from '../../../state/types';
import * as t from '@babel/types';
import { validateUseGTCallback } from '../../../utils/validation/validateTranslationFunctionCallback';
/**
 * Injects parameters into invocation of useGT_callback(..., { $_hash })
 * @param parentIdentifier - identifier from callback declaration (ie maps to useGT() call)
 */
export function injectUseGTCallbackParameters(
  callExpr: t.CallExpression,
  state: TransformState
) {
  // Increment counter
  const counterId = state.stringCollector.incrementCounter();

  // Check for existing hash
  const useGTCallbackParams = validateUseGTCallback(callExpr);
  state.errorTracker.addErrors(useGTCallbackParams.errors);
  if (useGTCallbackParams.errors.length > 0) {
    return;
  }
  if (useGTCallbackParams.hash !== undefined) {
    return;
  }

  // Get hash from string collector
  const translationHash = state.stringCollector.getTranslationHash(counterId);
  if (translationHash === undefined) {
    return;
  }

  // Inject parameters into invocation
  const newEntry = t.objectProperty(
    t.stringLiteral('$_hash'),
    t.stringLiteral(translationHash.hash)
  );
  if (callExpr.arguments.length === 1) {
    // add a new object to arguments
    callExpr.arguments.push(t.objectExpression([newEntry]));
  } else if (callExpr.arguments.length === 2) {
    if (t.isObjectExpression(callExpr.arguments[1])) {
      // add a new object to second argument
      callExpr.arguments[1].properties.push(newEntry);
    } else if (t.isExpression(callExpr.arguments[1])) {
      // convert identifier to object expression with spread
      callExpr.arguments[1] = t.objectExpression([
        t.spreadElement(callExpr.arguments[1]),
        newEntry,
      ]);
    } else if (t.isArgumentPlaceholder(callExpr.arguments[1])) {
      // add a new object to second argument
      callExpr.arguments[1] = t.objectExpression([newEntry]);
    }
  }
}
