import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import {
  GT_IMPORT_SOURCES,
  GT_OTHER_FUNCTIONS,
} from '../../utils/constants/gt/constants';

/**
 * Inject `import { t } from 'gt-react/browser'` as the first statement in the program.
 */
export function injectMacroImport(path: NodePath<t.Program>): void {
  const tName = GT_OTHER_FUNCTIONS.t;

  const importDecl = t.importDeclaration(
    [t.importSpecifier(t.identifier(tName), t.identifier(tName))],
    t.stringLiteral(GT_IMPORT_SOURCES.GT_REACT_BROWSER)
  );

  path.node.body.unshift(importDecl);
}
