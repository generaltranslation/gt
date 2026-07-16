import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformState } from '../../state/types';
import { GT_OTHER_FUNCTIONS } from '../../utils/constants/gt/constants';
import { transformTemplateLiteral } from '../../transform/macro-expansion/transformTemplateLiteral';
import { isStringTranslationCallExpression } from '../../utils/parsing/isStringTranslationCallExpression';

/**
 * Process call expressions for macro expansion.
 * Transforms t(`Hello, ${name}`) and t("Hello, " + name)
 * → t("Hello, {0}", { "0": name })
 *
 * Only transforms when:
 * - t is unbound (global macro via gt-react/macros)
 * - t is imported from a gt-react entrypoint
 * Skips when t is bound to a non-GT import (e.g., i18next)
 */
export function processCallExpression(
  state: TransformState
): VisitNode<t.Node, t.CallExpression> {
  const symbol = state.settings.stringTranslationMacro;
  // replaceWith requeues the new call for this same visitor; when the message
  // keeps derive() expressions it stays a template literal arg and would be
  // re-processed forever without this guard
  const replacements = new WeakSet<t.Node>();

  return (path) => {
    if (replacements.has(path.node)) return;
    if (path.node.arguments.length !== 1) return;

    const argPath = path.get('arguments')[0];
    if (argPath.isTemplateLiteral()) {
      if (!state.settings.enableTemplateLiteralArg) return;
    } else if (argPath.isBinaryExpression({ operator: '+' })) {
      if (!state.settings.enableConcatenationArg) return;
    } else {
      return;
    }
    if (!isStringTranslationCallExpression(path, symbol)) return;

    // Extract message from the argument, errors are logged by collection pass
    const { content, errors } = transformTemplateLiteral(argPath);
    // TODO: Until derive added, we only support one message variant
    const message = content[0]?.message;
    const variables = content[0]?.variables;
    if (errors.length > 0 || message == null) return;

    // Build the call expression arguments
    const args: t.Expression[] = [message];
    if (variables) args.push(variables);
    const replacement = t.callExpression(
      t.identifier(GT_OTHER_FUNCTIONS.t),
      args
    );
    replacements.add(replacement);
    path.replaceWith(replacement);
    state.statistics.macroExpansionsCount++;
  };
}
