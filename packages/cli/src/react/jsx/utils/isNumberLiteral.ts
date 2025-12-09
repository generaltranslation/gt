import * as t from '@babel/types';
/**
 * Given an expression, return true if it is a number literal
 * @param expr - The expression to check
 * @returns True if the expression is a number literal, false otherwise
 */
export function isNumberLiteral(expr: t.Expression): boolean {
  if (t.isUnaryExpression(expr)) {
    return (
      isNumberLiteral(expr.argument) &&
      (expr.operator === '-' || expr.operator === '+')
    );
  }
  return t.isNumericLiteral(expr);
}
