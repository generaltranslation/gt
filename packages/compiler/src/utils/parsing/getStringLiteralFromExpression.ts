import * as t from '@babel/types';
/**
 * Given an expression, return the string literal (throws an error if not a string literal)
 */
export function getStringLiteralFromExpression(expr: t.Expression): string {
  if (t.isStringLiteral(expr)) {
    return expr.value;
  }
  if (t.isTemplateLiteral(expr)) {
    if (expr.expressions.length === 0) {
      return expr.quasis[0]?.value.cooked || '';
    }
  }
  throw new Error('Expression is not a string literal');
}
