import { TraverseOptions } from '@babel/traverse';
import { TransformState } from '../state/types';
import { processTaggedTemplateExpression } from '../processing/macro-expansion/processTaggedTemplateExpression';
import { processCallExpression } from '../processing/macro-expansion/processCallExpression';
import { processImportDeclaration } from '../processing/macro-expansion/processImportDeclaration';
import { processProgram } from '../processing/macro-expansion/processProgram';

/**
 * Macro expansion pass — transforms t`...` tagged templates, t(`...`) template literal args,
 * and t("a" + b) concatenation args into normalized t() calls with ICU placeholders.
 *
 * This pass does NOT use basePass — it doesn't need scope tracking and must not
 * reset ScopeTracker/StringCollector state via processProgram.
 */
export function macroExpansionPass(state: TransformState): TraverseOptions {
  let alreadyImported = false;
  const countBefore = state.statistics.macroExpansionsCount;

  const onImportFound = () => {
    alreadyImported = true;
  };

  return {
    ImportDeclaration: processImportDeclaration(onImportFound),
    TaggedTemplateExpression: processTaggedTemplateExpression(state),
    CallExpression: processCallExpression(state),
    Program: processProgram({ state, countBefore, alreadyImported }),
  };
}
