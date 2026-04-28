import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformState } from '../../state/types';
import { transformTemplateLiteral } from '../../transform/macro-expansion/transformTemplateLiteral';
import { registerStandaloneTranslation } from '../../transform/registration/registerStandaloneTranslation';
import { isStringTranslationTaggedTemplate } from '../../utils/parsing/isStringTranslationTaggedTemplate';

/**
 * Process tagged template expressions during the collection pass.
 * Extracts the message for runtime-only entries (t`Hello ${name}`).
 *
 * Only extracts when:
 * - t is unbound (global macro)
 * - t is imported from gt-react/browser
 *
 * Does NOT transform the AST — read-only extraction.
 * If the message contains derive() (returns TemplateLiteral), it's skipped.
 */
export function processTaggedTemplateExpression(
  state: TransformState
): VisitNode<t.Node, t.TaggedTemplateExpression> {
  const symbol = state.settings.stringTranslationMacro;

  return (path) => {
    if (!isStringTranslationTaggedTemplate(path, symbol)) return;

    // Extract message from the template literal (reuse macro expansion utility)
    const { message } = transformTemplateLiteral(path.get('quasi'));

    // If message is a TemplateLiteral, it contains derive() — skip
    if (!t.isStringLiteral(message)) {
      return;
    }

    // Register as runtime-only content. Leaving injectHash undefined is
    // intentional: tagged templates do not reserve injection counter slots.
    registerStandaloneTranslation({
      state,
      content: message.value,
    });
  };
}
