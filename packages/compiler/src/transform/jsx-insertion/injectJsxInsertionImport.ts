import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import {
  GT_COMPONENT_TYPES,
  GT_IMPORT_SOURCES,
} from '../../utils/constants/gt/constants';

/**
 * Inject `import { GtInternalTranslateJsx, GtInternalVar } from 'gt-react/browser'`
 * as the first statement in the program.
 */
export function injectJsxInsertionImport(path: NodePath<t.Program>): void {
  const tName = GT_COMPONENT_TYPES.GtInternalTranslateJsx;
  const varName = GT_COMPONENT_TYPES.GtInternalVar;

  const importDecl = t.importDeclaration(
    [
      t.importSpecifier(t.identifier(tName), t.identifier(tName)),
      t.importSpecifier(t.identifier(varName), t.identifier(varName)),
    ],
    t.stringLiteral(GT_IMPORT_SOURCES.GT_REACT_BROWSER)
  );

  path.unshiftContainer('body', importDecl);
}
