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
    const { content, errors } = transformTemplateLiteral(path.get('quasi'));
    // TODO: Until derive added, we only support one message variant
    const message = content[0]?.message;
    if (errors.length > 0 || message == null) {
      state.errorTracker.addErrors(errors);
      return;
    }

    // If message is a TemplateLiteral, it contains derive() — skip
    // TODO: remove this check once derive is supported
    if (!t.isStringLiteral(message)) {
      return;
    }

    // Register as runtime-only content; tagged templates are not hash-injected.
    registerStandaloneTranslation({
      state,
      content: message.value,
      injectHash: false,
    });
  };
}
