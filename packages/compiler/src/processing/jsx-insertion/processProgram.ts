import { TransformState } from '../../state/types';
import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { injectJsxInsertionImport } from '../../transform/jsx-insertion/injectJsxInsertionImport';
import { JsxCalleeInfo } from './processImportDeclaration';
import { REACT_FUNTIONS } from '../../utils/constants/react/constants';
import { getJsxRuntimeSource } from '../../utils/constants/react/jsxImportSources';

/**
 * Process program:
 * - on exit, injects GtInternalTranslateJsx/GtInternalVar import if needed
 * - also injects `jsx` from the file's JSX runtime if only `jsxs` was imported
 *   (Vite production builds only import what's needed — if a file has only
 *   multi-child elements, `jsx` is never imported, but our _Var wrappers need it)
 */
export function processProgram({
  state,
  countBefore,
  isAlreadyImported,
  calleeInfo,
}: {
  state: TransformState;
  countBefore: number;
  isAlreadyImported: () => boolean;
  calleeInfo: JsxCalleeInfo;
}): VisitNode<t.Node, t.Program> {
  return {
    exit(path) {
      const didInsert = state.statistics.jsxInsertionsCount > countBefore;
      if (!didInsert) return;

      if (!isAlreadyImported()) {
        injectJsxInsertionImport(path, state.settings.autoJsxImportSource);
      }

      // If only jsxs was imported (no jsx), inject jsx import.
      // _Var wrappers always use singleCallee which defaults to 'jsx'.
      if (
        !calleeInfo.singleCallee &&
        calleeInfo.multiCallee &&
        calleeInfo.multiCalleeSource
      ) {
        const jsxImport = t.importDeclaration(
          [
            t.importSpecifier(
              t.identifier(REACT_FUNTIONS.jsx),
              t.identifier(REACT_FUNTIONS.jsx)
            ),
          ],
          t.stringLiteral(getJsxRuntimeSource(calleeInfo.multiCalleeSource))
        );
        path.unshiftContainer('body', jsxImport);
        calleeInfo.singleCallee = REACT_FUNTIONS.jsx;
      }
    },
  };
}
