import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformState } from '../../state/types';
import { GT_OTHER_FUNCTIONS } from '../../utils/constants/gt/constants';
import { GT_IMPORT_SOURCES } from '../../utils/constants/gt/constants';
import { transformTemplateLiteral } from '../../transform/macro-expansion/transformTemplateLiteral';
import { extractString } from '../../transform/templates-and-concat/extractString';
import { buildTransformResult } from '../../transform/templates-and-concat/buildTransformationResult';
import { multiply } from '../../nodes/multiply';

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

    // Only transform unbound t (global macro) or t imported from gt-react/browser
    const binding = path.scope.getBinding(symbol);
    if (binding) {
      if (!binding.path.isImportSpecifier()) return;
      const importDecl = binding.path.parentPath;
      if (
        !importDecl?.isImportDeclaration() ||
        importDecl.node.source.value !== GT_IMPORT_SOURCES.GT_REACT_BROWSER
      ) {
        return;
      }
    }

    // Extract the string parts
    const parts = extractString(path.get('quasi'), true);
    const variants = multiply(parts.value ?? []);
    if (variants.length !== 1) return;

    // Remap to a t() invocation
    const variant = variants[0];
    const { message, variables } = buildTransformResult(variant);
    const args: t.Expression[] = [message];
    if (variables) args.push(variables);
    path.replaceWith(
      t.callExpression(t.identifier(GT_OTHER_FUNCTIONS.t), args)
    );
    state.statistics.macroExpansionsCount++;
  };
}
