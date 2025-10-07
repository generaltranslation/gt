import * as t from '@babel/types';
import { createErrorLocation } from '../../../utils/errors';

/**
 * Given a template literal, validate it has no interpolation
 */
export function validateTemplateLiteral(templateLiteral: t.TemplateLiteral): {
  errors: string[];
  value?: string;
} {
  const errors: string[] = [];
  if (templateLiteral.expressions.length > 0) {
    errors.push(
      `Template literal cannot have interpolation: ${templateLiteral.quasis[0].value.cooked}` +
        createErrorLocation(templateLiteral)
    );
    return { errors };
  }
  return { errors, value: templateLiteral.quasis[0].value.cooked };
}
