import { TransformState } from '../../state/types';
import * as t from '@babel/types';
import { validateUseGTCallback } from '../validation/validateTranslationFunctionCallback';
import { injectHashIntoTranslationOptions } from './injectHashIntoTranslationOptions';

/**
 * Injects $_hash into standalone t() invocations.
 */
export function injectStandaloneTFunctionParameters(
  callExpr: t.CallExpression,
  state: TransformState
): void {
  const params = validateUseGTCallback(callExpr, state);
  state.errorTracker.addErrors(params.errors);
  if (
    params.errors.length > 0 ||
    params.content === undefined ||
    params.hasDeriveContext
  ) {
    return;
  }

  const counterId = state.stringCollector.incrementCounter();
  if (params.hash !== undefined) {
    return;
  }

  const translationHash = state.stringCollector.getTranslationHash(counterId);
  if (translationHash === undefined) {
    return;
  }

  injectHashIntoTranslationOptions(callExpr, translationHash.hash);
}
