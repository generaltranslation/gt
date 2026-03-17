import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { isGTImportSource } from '../../utils/constants/gt/helpers';
import { GT_OTHER_FUNCTIONS } from '../../utils/constants/gt/constants';

/**
 * Process import declarations during macro expansion.
 * Checks if `t` is already imported from a recognized GT source.
 */
export function processImportDeclaration(
  onFound: () => void
): VisitNode<t.Node, t.ImportDeclaration> {
  const tName = GT_OTHER_FUNCTIONS.t;

  return (path) => {
    if (!isGTImportSource(path.node.source.value)) return;

    for (const specifier of path.node.specifiers) {
      if (
        t.isImportSpecifier(specifier) &&
        t.isIdentifier(specifier.imported) &&
        specifier.imported.name === tName
      ) {
        onFound();
        return;
      }
    }
  };
}
