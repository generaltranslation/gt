import { TransformState } from '../../../state/types';
import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';

/**
 * Injects parameters into invocation of useMessages_callback(..., { $_hash })
 */
export function injectUseMessagesCallbackParameters(
  _callExprPath: NodePath<t.CallExpression>,
  _state: TransformState
) {}
