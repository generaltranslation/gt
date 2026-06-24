import { TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformState } from '../state/types';
import { injectMacroImport } from '../transform/macro-expansion/injectMacroImport';
import { transformTemplateLiteral } from '../transform/macro-expansion/transformTemplateLiteral';
import {
  GT_IMPORT_SOURCES,
  GT_OTHER_FUNCTIONS,
} from '../utils/constants/gt/constants';

/**
 * Macro expansion pass — transforms unbound global t`...` tagged templates
 * into normalized t() calls with ICU placeholders.
 *
 * This pass does NOT use basePass because it should not reset shared
 * ScopeTracker/StringCollector state.
 */
export function macroExpansionPass(state: TransformState): TraverseOptions {
  let hasBrowserTImport = false;
  const countBefore = state.statistics.macroExpansionsCount;
  const tName = GT_OTHER_FUNCTIONS.t;

  return {
    ImportDeclaration(path) {
      if (path.node.source.value !== GT_IMPORT_SOURCES.GT_REACT_BROWSER) {
        return;
      }
      hasBrowserTImport ||= path.node.specifiers.some(
        (specifier) =>
          t.isImportSpecifier(specifier) &&
          t.isIdentifier(specifier.imported, { name: tName }) &&
          specifier.local.name === tName
      );
    },
    TaggedTemplateExpression(path) {
      if (
        !t.isIdentifier(path.node.tag, {
          name: state.settings.stringTranslationMacro,
        })
      ) {
        return;
      }
      if (path.scope.getBinding(state.settings.stringTranslationMacro)) return;

      const { content, errors } = transformTemplateLiteral(path.get('quasi'));
      const message = content[0]?.message;
      const variables = content[0]?.variables;
      if (errors.length > 0 || message == null) return;

      const args: t.Expression[] = [message];
      if (variables) args.push(variables);
      path.replaceWith(t.callExpression(t.identifier(tName), args));
      state.statistics.macroExpansionsCount++;
    },
    Program: {
      exit(path) {
        const didTransform =
          state.statistics.macroExpansionsCount > countBefore;
        if (!didTransform || hasBrowserTImport) return;
        injectMacroImport(path);
      },
    },
  };
}
