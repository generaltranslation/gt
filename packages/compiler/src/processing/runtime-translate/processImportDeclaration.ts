import { NodePath, VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { isGTImportSource } from '../../utils/constants/gt/helpers';
import { GT_OTHER_FUNCTIONS } from '../../utils/constants/gt/constants';

/**
 * Tracks the import declaration path where the runtime translate functions
 * were found (or injected). Used to insert the Promise.all right after it.
 */
export interface ImportAnchor {
  path: NodePath<t.ImportDeclaration> | null;
}

/**
 * Process import declarations during runtime translate pass.
 * Checks if GtInternalRuntimeTranslateString and/or GtInternalRuntimeTranslateJsx
 * are already imported from a recognized GT source.
 * Also captures the import path as an anchor for statement insertion.
 */
export function processImportDeclaration(
  onStringFound: () => void,
  onJsxFound: () => void,
  importAnchor: ImportAnchor
): VisitNode<t.Node, t.ImportDeclaration> {
  const stringName = GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateString;
  const jsxName = GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateJsx;

  return (path) => {
    if (!isGTImportSource(path.node.source.value)) return;

    for (const specifier of path.node.specifiers) {
      if (
        t.isImportSpecifier(specifier) &&
        t.isIdentifier(specifier.imported)
      ) {
        if (specifier.imported.name === stringName) {
          onStringFound();
          importAnchor.path = path;
        }
        if (specifier.imported.name === jsxName) {
          onJsxFound();
          importAnchor.path = path;
        }
      }
    }
  };
}
