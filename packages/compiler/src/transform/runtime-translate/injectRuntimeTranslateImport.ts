import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { GT_OTHER_FUNCTIONS } from '../../utils/constants/gt/constants';
import { getGtReactImportSource } from '../../utils/constants/gt/helpers';

/**
 * Inject runtime translate import with only the specifiers needed.
 * `import { GtInternalRuntimeTranslateString, GtInternalRuntimeTranslateJsx } from 'gt-react'`
 */
export function injectRuntimeTranslateImport(
  path: NodePath<t.Program>,
  {
    needsString,
    needsJsx,
    legacyGtReactImportSource,
  }: {
    needsString: boolean;
    needsJsx: boolean;
    legacyGtReactImportSource: boolean;
  }
): NodePath<t.ImportDeclaration> | null {
  const specifiers: t.ImportSpecifier[] = [];

  if (needsString) {
    const name = GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateString;
    specifiers.push(t.importSpecifier(t.identifier(name), t.identifier(name)));
  }

  if (needsJsx) {
    const name = GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateJsx;
    specifiers.push(t.importSpecifier(t.identifier(name), t.identifier(name)));
  }

  if (specifiers.length === 0) return null;

  const importDecl = t.importDeclaration(
    specifiers,
    t.stringLiteral(getGtReactImportSource(legacyGtReactImportSource))
  );

  const [inserted] = path.unshiftContainer('body', importDecl);
  return inserted as NodePath<t.ImportDeclaration>;
}
