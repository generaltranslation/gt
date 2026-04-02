import { TransformState } from '../../state/types';
import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { injectJsxInsertionImport } from '../../transform/jsx-insertion/injectJsxInsertionImport';
import { JsxCalleeInfo } from './processImportDeclaration';
import { REACT_FUNTIONS } from '../../utils/constants/react/constants';
import { REACT_IMPORT_SOURCES } from '../../utils/constants/react/constants';

/**
 * Process program:
 * - on exit, injects GtInternalTranslateJsx/GtInternalVar import if needed
 * - also injects `jsx` from React runtime if only `jsxs` was imported
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
        injectJsxInsertionImport(path);
      }

      // If only jsxs was imported (no jsx), inject jsx import.
      // _Var wrappers always use singleCallee which defaults to 'jsx'.
      if (!calleeInfo.singleCallee && calleeInfo.multiCallee) {
        const jsxImport = t.importDeclaration(
          [
            t.importSpecifier(
              t.identifier(REACT_FUNTIONS.jsx),
              t.identifier(REACT_FUNTIONS.jsx)
            ),
          ],
          t.stringLiteral(REACT_IMPORT_SOURCES.JSX_RUNTIME)
        );
        path.unshiftContainer('body', jsxImport);
        calleeInfo.singleCallee = REACT_FUNTIONS.jsx;
      }
    },
  };
}
