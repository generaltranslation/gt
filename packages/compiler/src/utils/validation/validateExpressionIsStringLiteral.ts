import * as t from '@babel/types';

/**
 * Given an expression, check if it is a string literal
 * Valid: 'Hello', "Hello", `Hello`
 * Invalid: `Hello ${name}`, "Hello " + name, "Hello " + 1
 */
export function validateExpressionIsStringLiteral(expr: t.Expression): boolean {
  if (t.isStringLiteral(expr)) {
    return true;
  }
  if (t.isTemplateLiteral(expr)) {
    return expr.expressions.length === 0;
  }
  return false;
}
