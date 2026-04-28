import { TransformState } from '../../../state/types';
import * as t from '@babel/types';
import { validateUseGTCallback } from '../../validation/validateTranslationFunctionCallback';
import { injectHashIntoTranslationOptions } from '../injectHashIntoTranslationOptions';
import { NodePath } from '@babel/traverse';

/**
 * Injects parameters into invocation of useGT_callback(..., { $_hash })
 * @param parentIdentifier - identifier from callback declaration (ie maps to useGT() call)
 */
export function injectUseGTCallbackParameters(
  callExprPath: NodePath<t.CallExpression>,
  state: TransformState
) {
  const callExpr = callExprPath.node;
  // Increment counter
  const counterId = state.stringCollector.incrementCounter();

  // Check for existing hash
  const useGTCallbackParams = validateUseGTCallback(callExprPath, state);
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
  injectHashIntoTranslationOptions(callExpr, translationHash.hash);
}
