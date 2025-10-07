import { TransformState } from '../../state/types';
import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { trackVariableDeclarator } from '../../transform/tracking/trackVariableDeclarator';
import { injectCallbackFunctionParameters } from '../../transform/injection/injectCallbackFunctionParameters';

/**
 * Process variable assignments.
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
export function processVariableDeclarator(
  state: TransformState
): VisitNode<t.Node, t.VariableDeclarator> {
  return (path) => {
    trackVariableDeclarator(path.node, state);
    injectCallbackFunctionParameters(path.node, state);
  };
}
