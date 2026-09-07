import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { isAutoJsxImportSource } from './resolveAutoJsxComponent';
import { GT_COMPONENT_TYPES } from '../../utils/constants/gt/constants';

/**
 * Process import declarations during jsx insertion.
 * - Checks if GtInternalTranslateJsx is already imported from a GT source.
 */
export function processImportDeclaration(
  onGtImportFound: () => void,
  autoJsxImportSource?: string
): VisitNode<t.Node, t.ImportDeclaration> {
  const targetName = GT_COMPONENT_TYPES.GtInternalTranslateJsx;

  return (path) => {
    const source = path.node.source.value;

    // Check for existing GT import
    if (isAutoJsxImportSource(source) || source === autoJsxImportSource) {
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
  };
}
