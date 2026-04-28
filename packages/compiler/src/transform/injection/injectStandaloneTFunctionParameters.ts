import { TransformState } from '../../state/types';
import * as t from '@babel/types';
import { validateUseGTCallback } from '../validation/validateTranslationFunctionCallback';
import { injectHashIntoTranslationOptions } from './injectHashIntoTranslationOptions';
import { NodePath } from '@babel/traverse';

/**
 * Injects $_hash into standalone t() invocations.
 */
export function injectStandaloneTFunctionParameters(
  callExprPath: NodePath<t.CallExpression>,
  state: TransformState
): void {
  const callExpr = callExprPath.node;
  const params = validateUseGTCallback(callExprPath, state);
  state.errorTracker.addErrors(params.errors);
  if (
    params.errors.length > 0 ||
    params.content === undefined ||
    params.hasDeriveContext
  ) {
    return;
  }

  // Keep this aligned with collection, which registers every injectable t() call
  // even when the call already has $_hash.
  const counterId = state.stringCollector.incrementCounter();
  if (params.hash !== undefined) {
    return;
  }

  const translationHash = state.stringCollector.getTranslationHash(counterId);
  if (translationHash === undefined) {
    state.logger.logError(
      `[injectStandaloneTFunctionParameters] No hash found for counterId=${counterId}. Counter alignment may be broken.`
    );
    return;
  }

  injectHashIntoTranslationOptions(callExpr, translationHash.hash);
}
