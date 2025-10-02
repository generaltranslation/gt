import * as t from '@babel/types';
/**
 * Given a child from JsxChildren array validate it is Exclude<t.Expression, t.ArrayExpression>
 */
export function validateChildrenElement(
  child: t.Expression | t.SpreadElement | null
): child is Exclude<t.Expression, t.ArrayExpression> {
  // Validate isExpression
  if (!t.isExpression(child)) {
    return false;
  }
  if (t.isArrayExpression(child)) {
    return false;
  }
  return true;
}
