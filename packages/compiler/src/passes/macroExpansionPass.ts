import { TraverseOptions } from '@babel/traverse';
import { TransformState } from '../state/types';
import { processTaggedTemplateExpression } from '../processing/macro-expansion/processTaggedTemplateExpression';
import { processCallExpression } from '../processing/macro-expansion/processCallExpression';
import { injectMacroImport } from '../transform/macro-expansion/injectMacroImport';

/**
 * Macro expansion pass — transforms t`...` tagged templates, t(`...`) template literal args,
 * and t("a" + b) concatenation args into normalized t() calls with ICU placeholders.
 *
 * This pass does NOT use basePass — it doesn't need scope tracking and must not
 * reset ScopeTracker/StringCollector state via processProgram.
 */
export function macroExpansionPass(state: TransformState): TraverseOptions {
  let needsImport = false;
  const onTransformed = () => {
    needsImport = true;
  };

  return {
    TaggedTemplateExpression: processTaggedTemplateExpression(
      state,
      onTransformed
    ),
    CallExpression: processCallExpression(state, onTransformed),
    Program: {
      exit(path) {
        if (!needsImport || !state.settings.enableMacroImportInjection) return;
        injectMacroImport(path, state);
      },
    },
  };
}
