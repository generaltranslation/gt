import { TransformState } from '../../state/types';
import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { injectJsxInsertionImport } from '../../transform/jsx-insertion/injectJsxInsertionImport';

/**
 * Process program:
 * - on exit, injects GtInternalTranslateJsx/GtInternalVar import if needed
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
      const didInsert = state.statistics.jsxInsertionsCount > countBefore;
      if (!didInsert || isAlreadyImported()) return;
      injectJsxInsertionImport(path);
    },
  };
}
