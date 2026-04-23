import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformState } from '../../state/types';
import { GT_IMPORT_SOURCES } from '../../utils/constants/gt/constants';
import { transformTemplateLiteral } from '../../transform/macro-expansion/transformTemplateLiteral';
import hashSource from '../../utils/calculateHash';
import type { ResolutionNode } from '../../nodes/types';
import { multiply } from '../../nodes/multiply';

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
    if (!t.isIdentifier(path.node.tag, { name: symbol })) return;

    // Same scope guard as macro expansion: only process unbound t (global macro)
    // or t imported from gt-react/browser
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

    // Extract message from the template literal (reuse macro expansion utility)
    // TODO: need a custom version of transformTemplateLiteral for returning ResolutionNode<string> as we cannot just ignore the derive() calls
    const { message } = transformTemplateLiteral(path.get('quasi'));

    // If message is a TemplateLiteral, it contains derive() — skip
    if (!t.isStringLiteral(message)) {
      return;
    }

    // Run through multiplication pipeline (no-op without ChoiceNodes)
    const resolutionNodes: ResolutionNode<string>[] = [message.value];
    const variants = multiply(resolutionNodes);
    const content = variants[0].join('');

    const hash = hashSource({
      source: content,
      dataFormat: 'ICU',
    });

    state.stringCollector.pushRuntimeOnlyContent({
      message: content,
      hash,
    });
  };
}
