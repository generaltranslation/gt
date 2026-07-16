import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { isStringTranslationMacroBinding } from './isStringTranslationMacroBinding';

/**
 * Checks whether a call expression should be treated as the GT string
 * translation macro (the call-argument forms: t(`...`) and t("a" + b)).
 *
 * The macro is valid when it is an unbound bare identifier, or when it is
 * imported from gt-react. This covers global `t`, but not explicit
 * member access such as `globalThis.t` or `window.t`. Other bindings are left
 * alone so local/i18next t calls do not get transformed or extracted.
 */
export function isStringTranslationCallExpression(
  path: NodePath<t.CallExpression>,
  symbol: string
): boolean {
  if (!t.isIdentifier(path.node.callee, { name: symbol })) {
    return false;
  }

  return isStringTranslationMacroBinding(path.scope, symbol);
}
