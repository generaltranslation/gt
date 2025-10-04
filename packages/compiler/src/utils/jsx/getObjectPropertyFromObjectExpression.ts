import * as t from '@babel/types';
/**
 * Given an expression, return the object property
 */
export function getObjectPropertyFromObjectExpression(
  objExpr: t.ObjectExpression,
  name: string
): t.ObjectExpression['properties'][0] | undefined {
  return objExpr.properties.find((property) => {
    if (t.isSpreadElement(property)) {
      return false;
    }
    if (t.isIdentifier(property.key) && property.key.name === name) {
      return true;
    }
    if (t.isStringLiteral(property.key) && property.key.value === name) {
      return true;
    }
    return false;
  });
}
