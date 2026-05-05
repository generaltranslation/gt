import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

function objectPropertyMatchesName(
  property: t.ObjectExpression['properties'][0],
  name: string
): boolean {
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
}

/**
 * Given an expression, return the object property
 */
export function getObjectPropertyFromObjectExpression(
  objExpr: t.ObjectExpression,
  name: string
): t.ObjectExpression['properties'][0] | undefined {
  return objExpr.properties.find((property) =>
    objectPropertyMatchesName(property, name)
  );
}

/**
 * Given an expression path, return the object property path
 */
export function getObjectPropertyPathFromObjectExpression(
  objExprPath: NodePath<t.ObjectExpression>,
  name: string
): NodePath<t.ObjectExpression['properties'][0]> | undefined {
  return objExprPath
    .get('properties')
    .find((propertyPath) =>
      objectPropertyMatchesName(propertyPath.node, name)
    ) as NodePath<t.ObjectExpression['properties'][0]> | undefined;
}
