import * as t from '@babel/types';
import { GT_DERIVE_STRING_FUNCTIONS } from '../../constants.js';

/**
 * Lightweight name-based check for whether an expression tree contains
 * a derive()/declareStatic() call. Does NOT validate imports or scope —
 * used as a fast gate before full resolution via handleDerivation().
 */
export function containsDeriveCall(expr: t.Expression): boolean {
  if (t.isCallExpression(expr) && t.isIdentifier(expr.callee)) {
    return GT_DERIVE_STRING_FUNCTIONS.includes(
      expr.callee.name as (typeof GT_DERIVE_STRING_FUNCTIONS)[number]
    );
  }
  if (t.isBinaryExpression(expr)) {
    return (
      (t.isExpression(expr.left) && containsDeriveCall(expr.left)) ||
      (t.isExpression(expr.right) && containsDeriveCall(expr.right))
    );
  }
  if (t.isTemplateLiteral(expr)) {
    return expr.expressions.some(
      (e) => t.isExpression(e) && containsDeriveCall(e)
    );
  }
  if (t.isConditionalExpression(expr)) {
    return (
      containsDeriveCall(expr.consequent) || containsDeriveCall(expr.alternate)
    );
  }
  if (t.isParenthesizedExpression(expr)) {
    return containsDeriveCall(expr.expression);
  }
  return false;
}
