import * as t from '@babel/types';
import { validateExpressionIsStringLiteral } from '../validation/validateExpressionIsStringLiteral';
import { getStringLiteralFromExpression } from './getStringLiteralFromExpression';
/**
 * Given an expression, return the object property
 */
export function getStringLiteralFromObjectExpression(
  objExpr: t.ObjectExpression,
  name: string
): string | undefined {
  for (const property of objExpr.properties) {
    // Skip spread elements and methods
    if (t.isSpreadElement(property) || t.isMethod(property)) {
      continue;
    }
    // Skip non-string literals
    // TODO: switch this over to error extraction format
    if (
      !t.isExpression(property.value) ||
      !validateExpressionIsStringLiteral(property.value)
    ) {
      continue;
    }
    // Skip non-matching keys
    if (t.isIdentifier(property.key) && property.key.name === name) {
      return getStringLiteralFromExpression(property.value);
    }
    if (t.isStringLiteral(property.key) && property.key.value === name) {
      return getStringLiteralFromExpression(property.value);
    }
  }
}
