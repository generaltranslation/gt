import { TransformState } from '../../../state/types';
import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';

/**
 * Injects parameters into invocation of useTranslations_callback(..., { $_hash })
 */
export function injectUseTranslationsCallbackParameters(
  _callExprPath: NodePath<t.CallExpression>,
  _state: TransformState
) {}
