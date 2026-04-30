import { TransformState } from '../../../state/types';
import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';

/**
 * Injects parameters into invocation of useMessages_callback(..., { $_hash })
 */
export function injectUseMessagesCallbackParameters(
  callExprPath: NodePath<t.CallExpression>,
  state: TransformState
) {}
