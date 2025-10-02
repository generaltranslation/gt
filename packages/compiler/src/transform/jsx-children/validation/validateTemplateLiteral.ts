import * as t from '@babel/types';

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
      `Template literal cannot have interpolation: ${templateLiteral.quasis[0].value.cooked}`
    );
    return { errors };
  }
  return { errors, value: templateLiteral.quasis[0].value.cooked };
}
