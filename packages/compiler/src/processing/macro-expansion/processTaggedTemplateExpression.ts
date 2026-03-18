import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformState } from '../../state/types';
import { GT_OTHER_FUNCTIONS } from '../../utils/constants/gt/constants';
import { isGTImportSource } from '../../utils/constants/gt/helpers';
import { transformTemplateLiteral } from '../../transform/macro-expansion/transformTemplateLiteral';

/**
 * Process tagged template expressions for macro expansion.
 * Transforms t`Hello, ${name}` → t("Hello, {0}", { "0": name })
 *
 * Only transforms when:
 * - t is unbound (global macro via gt-react/macros)
 * - t is imported from a recognized GT source
 * Skips when t is bound to a non-GT import (e.g., i18next)
 */
export function processTaggedTemplateExpression(
  state: TransformState
): VisitNode<t.Node, t.TaggedTemplateExpression> {
  const symbol = state.settings.stringTranslationMacro;

  return (path) => {
    if (!state.settings.enableTaggedTemplate) return;
    if (!t.isIdentifier(path.node.tag, { name: symbol })) return;

    // If bound to a non-GT import, skip transformation
    const binding = path.scope.getBinding(symbol);
    if (binding?.path.isImportSpecifier()) {
      const importDecl = binding.path.parentPath;
      if (
        importDecl?.isImportDeclaration() &&
        !isGTImportSource(importDecl.node.source.value)
      ) {
        return;
      }
    }

    const { message, variables } = transformTemplateLiteral(path.node.quasi);
    const args: t.Expression[] = [message];
    if (variables) args.push(variables);

    path.replaceWith(
      t.callExpression(t.identifier(GT_OTHER_FUNCTIONS.t), args)
    );
    state.statistics.macroExpansionsCount++;
  };
}
