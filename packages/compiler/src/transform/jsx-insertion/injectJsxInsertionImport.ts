import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { GT_COMPONENT_TYPES } from '../../utils/constants/gt/constants';
import { getGtReactImportSource } from '../../utils/constants/gt/helpers';

/**
 * Inject `import { GtInternalTranslateJsx, GtInternalVar } from 'gt-react'`
 * as the first statement in the program.
 */
export function injectJsxInsertionImport(
  path: NodePath<t.Program>,
  autoJsxImportSource: string | undefined,
  legacyGtReactImportSource: boolean
): void {
  const tName = GT_COMPONENT_TYPES.GtInternalTranslateJsx;
  const varName = GT_COMPONENT_TYPES.GtInternalVar;

  const importDecl = t.importDeclaration(
    [
      t.importSpecifier(t.identifier(tName), t.identifier(tName)),
      t.importSpecifier(t.identifier(varName), t.identifier(varName)),
    ],
    t.stringLiteral(
      autoJsxImportSource ?? getGtReactImportSource(legacyGtReactImportSource)
    )
  );

  path.unshiftContainer('body', importDecl);
}
