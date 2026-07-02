import * as t from '@babel/types';

/**
 * Given an expression, check if it is a boolean literal
 * Valid: true, false
 * Invalid: 'true', "false", !!flag, someVar, 1
 */
export function validateExpressionIsBooleanLiteral(
  expr: t.Expression
): boolean {
  return t.isBooleanLiteral(expr);
}
