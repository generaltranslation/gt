import type { Scope } from '@babel/traverse';
import { isGTReactImportSource } from '../constants/gt/helpers';

/**
 * Checks whether the macro symbol resolves to a binding that should be
 * treated as the GT string translation macro in the given scope.
 *
 * Valid when the symbol is unbound (global macro via gt-react/macros) or
 * imported from gt-react. Other bindings (local variables, destructured
 * values, non-GT imports such as i18next) are left alone.
 */
export function isStringTranslationMacroBinding(
  scope: Scope,
  symbol: string
): boolean {
  const binding = scope.getBinding(symbol);
  if (!binding) {
    return true;
  }

  if (!binding.path.isImportSpecifier()) {
    return false;
  }

  const importDecl = binding.path.parentPath;
  return (
    importDecl?.isImportDeclaration() === true &&
    isGTReactImportSource(importDecl.node.source.value)
  );
}
