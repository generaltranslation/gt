import * as t from '@babel/types';
import { getObjectPropertyFromObjectExpression } from '../../../utils/parsing/getObjectPropertyFromObjectExpression';
import { getStringLiteralFromExpression } from '../../../utils/parsing/getStringLiteralFromExpression';
import { createErrorLocation } from '../../../utils/errors';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { RESERVED_NAME_PREFIX } from '@generaltranslation/icu/internal';

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
  const value = getStringLiteralFromExpression(nameProperty.value);
  if (value.startsWith(RESERVED_NAME_PREFIX)) {
    errors.push(
      createDiagnosticMessage({
        whatHappened: `The variable name "${value}" starts with the reserved "${RESERVED_NAME_PREFIX}" prefix`,
        fix: 'Pick another name',
      }) + createErrorLocation(nameProperty.value)
    );
    return { errors };
  }
  return { errors, value };
}
