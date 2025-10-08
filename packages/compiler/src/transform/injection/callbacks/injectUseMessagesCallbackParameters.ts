import { TransformState } from '../../../state/types';
import * as t from '@babel/types';

/**
 * Injects parameters into invocation of useMessages_callback(..., { $_hash })
 */
export function injectUseMessagesCallbackParameters(
  callExpr: t.CallExpression,
  state: TransformState
) {}
