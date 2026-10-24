import { TransformState } from '../../state/types';
import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { injectRuntimeTranslateImport } from '../../transform/runtime-translate/injectRuntimeTranslateImport';
import { buildRuntimeTranslateCalls } from '../../transform/runtime-translate/buildRuntimeTranslateCalls';
import { ImportAnchor } from './processImportDeclaration';

/**
 * Process program for runtime translate pass:
 * - On exit, reads collected strings and JSX content from StringCollector
 * - Filters out derive entries (hash === '')
 * - Injects import and await Promise.all([...]) with runtime translate calls
 */
export function processProgram({
  state,
  isStringAlreadyImported,
  isJsxAlreadyImported,
  importAnchor,
}: {
  state: TransformState;
  isStringAlreadyImported: () => boolean;
  isJsxAlreadyImported: () => boolean;
  importAnchor: ImportAnchor;
}): VisitNode<t.Node, t.Program> {
  return {
    exit(path) {
      // Read collected content, filtered by granular devHotReload config
      const allStrings = state.settings.devHotReload.strings
        ? [
            ...state.stringCollector.getAllTranslationContent(),
            ...state.stringCollector.getRuntimeOnlyContent(),
          ].filter((entry) => entry.hash !== '')
        : [];
      const allJsx = state.settings.devHotReload.jsx
        ? state.stringCollector
            .getAllTranslationJsx()
            .filter((entry) => entry.hash !== '')
        : [];

      // Nothing to inject
      if (allStrings.length === 0 && allJsx.length === 0) return;

      // Build the await Promise.all([...]) statement
      const promiseAllStatement = buildRuntimeTranslateCalls({
        strings: allStrings,
        jsx: allJsx,
      });

      // Inject import with only the specifiers that are needed and not already imported
      const needsString = allStrings.length > 0 && !isStringAlreadyImported();
      const needsJsx = allJsx.length > 0 && !isJsxAlreadyImported();

      if (needsString || needsJsx) {
        const injectedPath = injectRuntimeTranslateImport(path, {
          needsString,
          needsJsx,
        });
        if (injectedPath) {
          importAnchor.path = injectedPath;
        }
      }

      // Insert the Promise.all statement right after the runtime translate import
      if (importAnchor.path) {
        importAnchor.path.insertAfter(promiseAllStatement);
      } else {
        path.unshiftContainer('body', promiseAllStatement);
      }

      // Track that we injected runtime translate calls
      state.statistics.runtimeTranslateCount =
        allStrings.length + allJsx.length;
    },
  };
}
