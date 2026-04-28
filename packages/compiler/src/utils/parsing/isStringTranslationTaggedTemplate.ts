import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { GT_IMPORT_SOURCES } from '../constants/gt/constants';

/**
 * Checks whether a tagged template expression should be treated as the GT
 * string translation macro.
 *
 * The macro is valid when it is an unbound bare identifier, or when it is
 * imported from gt-react/browser. This covers global `t`, but not explicit
 * member access such as `globalThis.t` or `window.t`. Other bindings are left
 * alone so local/i18next t tags do not get transformed or extracted.
 */
export function isStringTranslationTaggedTemplate(
  path: NodePath<t.TaggedTemplateExpression>,
  symbol: string
): boolean {
  if (!t.isIdentifier(path.node.tag, { name: symbol })) {
    return false;
  }

  const binding = path.scope.getBinding(symbol);
  if (!binding) {
    return true;
  }

  if (!binding.path.isImportSpecifier()) {
    return false;
  }

  const importDecl = binding.path.parentPath;
  return (
    importDecl?.isImportDeclaration() === true &&
    importDecl.node.source.value === GT_IMPORT_SOURCES.GT_REACT_BROWSER
  );
}
