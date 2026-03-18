import { TransformState } from '../../state/types';
import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { injectMacroImport } from '../../transform/macro-expansion/injectMacroImport';

/**
 * Process program:
 * - on exit,injects macro import if needed
 * @param {Object} param0 - The parameters for the function.
 * @param {TransformState} param0.state - The state of the transformation.
 * @param {number} param0.countBefore - The count before the transformation.
 * @param {boolean} param0.alreadyImported - Whether the macro import has already been injected.
 * @returns {VisitNode<t.Node, t.Program>} The visit node for the program.
 */
export function processProgram({
  state,
  countBefore,
  isAlreadyImported,
}: {
  state: TransformState;
  countBefore: number;
  isAlreadyImported: () => boolean;
}): VisitNode<t.Node, t.Program> {
  return {
    exit(path) {
      // (1) Check if the macro expansions count has changed
      const didTransform = state.statistics.macroExpansionsCount > countBefore;
      if (!didTransform || isAlreadyImported()) return;
      // (2) If the macro import injection is disabled, return.
      if (!state.settings.enableMacroImportInjection) return;
      // Inject the macro import.
      injectMacroImport(path);
    },
  };
}
