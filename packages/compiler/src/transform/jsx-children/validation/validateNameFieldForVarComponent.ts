import * as t from '@babel/types';
import { getObjectPropertyFromObjectExpression } from '../../../utils/jsx/getObjectPropertyFromObjectExpression';
import { getStringLiteralFromExpression } from '../../../utils/jsx/getStringLiteralFromExpression';
import { createErrorLocation } from '../../../utils/errors';

/**
 * Extracts name field for var component
 * @param args
 * @param state
 */
export function validateNameFieldForVarComponent(
  parameters: t.ObjectExpression
): {
  errors: string[];
  value?: string;
} {
  const errors: string[] = [];
  const nameProperty = getObjectPropertyFromObjectExpression(
    parameters,
    'name'
  );
  if (!nameProperty) return { errors, value: undefined };
  if (
    !t.isObjectProperty(nameProperty) ||
    !t.isExpression(nameProperty.value)
  ) {
    errors.push(
      'Failed to construct Variable! Name field must be an expression' +
        createErrorLocation(nameProperty)
    );
    return { errors };
  }
  if (
    !t.isStringLiteral(nameProperty.value) &&
    !t.isTemplateLiteral(nameProperty.value)
  ) {
    errors.push(
      'Failed to construct Variable! Name field must be a string literal' +
        createErrorLocation(nameProperty.value)
    );
    return { errors };
  }
  return { errors, value: getStringLiteralFromExpression(nameProperty.value) };
}
