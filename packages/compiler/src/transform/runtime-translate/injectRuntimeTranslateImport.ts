import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import {
  GT_IMPORT_SOURCES,
  GT_OTHER_FUNCTIONS,
} from '../../utils/constants/gt/constants';

/**
 * Inject the runtime translate import.
 * `import { GtInternalRuntimeTranslateJsx } from 'gt-react'`
 */
export function injectRuntimeTranslateImport(
  path: NodePath<t.Program>
): NodePath<t.ImportDeclaration> {
  const name = GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateJsx;
  const importDecl = t.importDeclaration(
    [t.importSpecifier(t.identifier(name), t.identifier(name))],
    t.stringLiteral(GT_IMPORT_SOURCES.GT_REACT)
  );

  const [inserted] = path.unshiftContainer('body', importDecl);
  return inserted as NodePath<t.ImportDeclaration>;
}
