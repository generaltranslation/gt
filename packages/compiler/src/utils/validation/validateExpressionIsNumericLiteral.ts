import * as t from '@babel/types';

/**
 * Given an expression, check if it is a numeric literal
 */
export function validateExpressionIsNumericLiteral(
  expr: t.Expression
): boolean {
  if (t.isNumericLiteral(expr)) {
    return true;
  }
  // handle numbers with unary operators
  if (t.isUnaryExpression(expr) && t.isNumericLiteral(expr.argument)) {
    return true;
  }
  return false;
}
