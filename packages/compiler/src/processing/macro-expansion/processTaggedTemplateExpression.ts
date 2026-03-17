import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformState } from '../../state/types';
import { GT_OTHER_FUNCTIONS } from '../../utils/constants/gt/constants';
import { transformTemplateLiteral } from '../../transform/macro-expansion/transformTemplateLiteral';

/**
 * Process tagged template expressions for macro expansion.
 * Transforms t`Hello, ${name}` → t("Hello, {0v_name}", { "0v_name": name })
 */
export function processTaggedTemplateExpression(
  state: TransformState
): VisitNode<t.Node, t.TaggedTemplateExpression> {
  const symbol = state.settings.stringTranslationMacro;

  return (path) => {
    if (!state.settings.enableTaggedTemplate) return;
    if (!t.isIdentifier(path.node.tag, { name: symbol })) return;

    const { message, variables } = transformTemplateLiteral(path.node.quasi);
    const args: t.Expression[] = [message];
    if (variables) args.push(variables);

    path.replaceWith(
      t.callExpression(t.identifier(GT_OTHER_FUNCTIONS.t), args)
    );
    state.statistics.macroExpansionsCount++;
  };
}
