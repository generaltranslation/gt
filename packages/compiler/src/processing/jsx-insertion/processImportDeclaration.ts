import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { isGTImportSource } from '../../utils/constants/gt/helpers';
import { isReactImportSource } from '../../utils/constants/react/helpers';
import { GT_COMPONENT_TYPES } from '../../utils/constants/gt/constants';
import { REACT_FUNTIONS } from '../../utils/constants/react/constants';

/**
 * Info about the jsx callee names used in the file.
 * Populated during import analysis so processCallExpression
 * knows which callee to use for jsx (single child) vs jsxs (array children).
 */
export interface JsxCalleeInfo {
  /** Local name for single-child calls (jsx or _jsx or _jsxDEV) */
  singleCallee: string | null;
  /** Local name for multi-child calls (jsxs or _jsxs or _jsxDEV) */
  multiCallee: string | null;
}

/**
 * Process import declarations during jsx insertion.
 * - Checks if GtInternalTranslateJsx is already imported from a GT source.
 * - Collects React jsx callee info (jsx vs jsxs vs jsxDEV, including aliases).
 */
export function processImportDeclaration(
  onGtImportFound: () => void,
  calleeInfo: JsxCalleeInfo
): VisitNode<t.Node, t.ImportDeclaration> {
  const targetName = GT_COMPONENT_TYPES.GtInternalTranslateJsx;

  return (path) => {
    const source = path.node.source.value;

    // Check for existing GT import
    if (isGTImportSource(source)) {
      for (const specifier of path.node.specifiers) {
        if (
          t.isImportSpecifier(specifier) &&
          t.isIdentifier(specifier.imported) &&
          specifier.imported.name === targetName
        ) {
          onGtImportFound();
          return;
        }
      }
    }

    // Collect React jsx callee names
    if (isReactImportSource(source)) {
      for (const specifier of path.node.specifiers) {
        if (!t.isImportSpecifier(specifier)) continue;
        const imported = specifier.imported;
        const originalName = t.isIdentifier(imported)
          ? imported.name
          : imported.value;
        const localName = specifier.local.name;

        if (originalName === REACT_FUNTIONS.jsxDEV) {
          // Dev mode: jsxDEV handles both single and multi children
          calleeInfo.singleCallee = localName;
          calleeInfo.multiCallee = localName;
        } else if (originalName === REACT_FUNTIONS.jsx) {
          calleeInfo.singleCallee = localName;
        } else if (originalName === REACT_FUNTIONS.jsxs) {
          calleeInfo.multiCallee = localName;
        }
      }
    }
  };
}
