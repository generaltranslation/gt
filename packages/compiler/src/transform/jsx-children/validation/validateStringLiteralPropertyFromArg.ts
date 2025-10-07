import * as t from '@babel/types';
import { getObjectPropertyFromObjectExpression } from '../../../utils/parsing/getObjectPropertyFromObjectExpression';

/**
 * Given (t.ArgumentPlaceholder | t.SpreadElement | t.Expression)[] extracts property and validates
 */
export function validateStringLiteralPropertyFromArg(
  arg: t.ObjectExpression,
  name: string
): {
  errors: string[];
  value?: string;
} {
  const errors: string[] = [];

  // Get the children property
  const propertyObjExpression = getObjectPropertyFromObjectExpression(
    arg,
    name
  );

  // Early return if no property found
  if (!propertyObjExpression) {
    return { errors, value: undefined };
  }

  // Validate propertyObjExpression
  if (
    !t.isObjectProperty(propertyObjExpression) ||
    !t.isExpression(propertyObjExpression.value)
  ) {
    return { errors, value: undefined };
  }

  // Get the string literal
  if (t.isStringLiteral(propertyObjExpression.value)) {
    return { errors, value: propertyObjExpression.value.value };
  }
  if (t.isTemplateLiteral(propertyObjExpression.value)) {
    if (propertyObjExpression.value.expressions.length === 0) {
      return {
        errors,
        value: propertyObjExpression.value.quasis[0]?.value.cooked || '',
      };
    }
  }

  return { errors, value: undefined };
}
