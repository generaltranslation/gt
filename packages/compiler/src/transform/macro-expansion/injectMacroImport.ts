import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { TransformState } from '../../state/types';
import { isGTImportSource } from '../../utils/constants/gt/helpers';
import {
  GT_IMPORT_SOURCES,
  GT_OTHER_FUNCTIONS,
} from '../../utils/constants/gt/constants';

/**
 * Inject `import { t } from 'gt-react/browser'` into the program if not already present.
 *
 * Checks existing imports from any recognized GT import source to avoid duplicates.
 * Gated by the `enableMacroImportInjection` setting.
 */
export function injectMacroImport(
  path: NodePath<t.Program>,
  state: TransformState
): void {
  if (!state.settings.enableMacroImportInjection) return;

  const tName = GT_OTHER_FUNCTIONS.t;

  // Check if t is already imported from a GT source
  for (const node of path.node.body) {
    if (!t.isImportDeclaration(node)) continue;
    if (!isGTImportSource(node.source.value)) continue;

    for (const specifier of node.specifiers) {
      if (
        t.isImportSpecifier(specifier) &&
        t.isIdentifier(specifier.imported) &&
        specifier.imported.name === tName
      ) {
        // Already imported from a GT source
        return;
      }
    }
  }

  // Build: import { t } from 'gt-react/browser'
  const importDecl = t.importDeclaration(
    [t.importSpecifier(t.identifier(tName), t.identifier(tName))],
    t.stringLiteral(GT_IMPORT_SOURCES.GT_REACT_BROWSER)
  );

  path.node.body.unshift(importDecl);
}
