import { TransformState } from '../../state/types';
import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { injectRuntimeTranslateImport } from '../../transform/runtime-translate/injectRuntimeTranslateImport';
import { buildRuntimeTranslateCalls } from '../../transform/runtime-translate/buildRuntimeTranslateCalls';
import { ImportAnchor } from './processImportDeclaration';

/**
 * Process program for runtime translate pass:
 * - On exit, reads collected JSX content from StringCollector
 * - Filters out derive entries (hash === '')
 * - Injects import and await Promise.all([...]) with runtime translate calls
 */
export function processProgram({
  state,
  isAlreadyImported,
  importAnchor,
}: {
  state: TransformState;
  isAlreadyImported: () => boolean;
  importAnchor: ImportAnchor;
}): VisitNode<t.Node, t.Program> {
  return {
    exit(path) {
      const allJsx = state.stringCollector
        .getAllTranslationJsx()
        .filter((entry) => entry.hash !== '');

      // Nothing to inject
      if (allJsx.length === 0) return;

      // Build the await Promise.all([...]) statement
      const promiseAllStatement = buildRuntimeTranslateCalls(allJsx);

      if (!isAlreadyImported()) {
        importAnchor.path = injectRuntimeTranslateImport(path);
      }

      // Insert the Promise.all statement right after the runtime translate import
      if (importAnchor.path) {
        importAnchor.path.insertAfter(promiseAllStatement);
      } else {
        path.unshiftContainer('body', promiseAllStatement);
      }

      // Track that we injected runtime translate calls
      state.statistics.runtimeTranslateCount = allJsx.length;
    },
  };
}
