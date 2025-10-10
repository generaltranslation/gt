import { TransformState } from '../../../state/types';
import * as t from '@babel/types';

/**
 * Injects parameters into invocation of useTranslations_callback(..., { $_hash })
 */
export function injectUseTranslationsCallbackParameters(
  callExpr: t.CallExpression,
  state: TransformState
) {}
