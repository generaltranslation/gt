import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformState } from '../../state/types';
import { GT_OTHER_FUNCTIONS } from '../../utils/constants/gt/constants';
import { transformTemplateLiteral } from '../../transform/macro-expansion/transformTemplateLiteral';
import { isStringTranslationTaggedTemplate } from '../../utils/parsing/isStringTranslationTaggedTemplate';

/**
 * Process tagged template expressions for macro expansion.
 * Transforms t`Hello, ${name}` → t("Hello, {0}", { "0": name })
 *
 * Only transforms when:
 * - t is unbound (global macro via gt-react/macros)
 * - t is imported from gt-react/browser
 * Skips when t is bound to a non-GT import (e.g., i18next)
 */
export function processTaggedTemplateExpression(
  state: TransformState
): VisitNode<t.Node, t.TaggedTemplateExpression> {
  const symbol = state.settings.stringTranslationMacro;

  return (path) => {
    if (!state.settings.enableTaggedTemplate) return;
    if (!isStringTranslationTaggedTemplate(path, symbol)) return;

    // Extract message from the template literal, errors are logged by collection pass
    const { content, errors } = transformTemplateLiteral(path.get('quasi'));
    // TODO: Until derive added, we only support one message variant
    const message = content[0]?.message;
    const variables = content[0]?.variables;
    if (errors.length > 0 || message == null) return;

    // Build the call expression arguments
    const args: t.Expression[] = [message];
    if (variables) args.push(variables);
    path.replaceWith(
      t.callExpression(t.identifier(GT_OTHER_FUNCTIONS.t), args)
    );
    state.statistics.macroExpansionsCount++;
  };
}
