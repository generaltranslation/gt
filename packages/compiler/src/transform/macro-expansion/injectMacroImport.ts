import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { GT_OTHER_FUNCTIONS } from '../../utils/constants/gt/constants';
import { getGtReactImportSource } from '../../utils/constants/gt/helpers';

/**
 * Inject `import { t } from 'gt-react'` as the first statement in the program.
 */
export function injectMacroImport(
  path: NodePath<t.Program>,
  legacyGtReactImportSource: boolean
): void {
  const tName = GT_OTHER_FUNCTIONS.t;

  const importDecl = t.importDeclaration(
    [t.importSpecifier(t.identifier(tName), t.identifier(tName))],
    t.stringLiteral(getGtReactImportSource(legacyGtReactImportSource))
  );

  path.unshiftContainer('body', importDecl);
}
