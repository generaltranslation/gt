import * as t from '@babel/types';

/**
 * Transform a TemplateLiteral AST node into a normalized t() call format.
 *
 * Converts template literal quasis and expressions into an ICU-style message
 * string with variable placeholders in the format {indexv_varName}.
 */
export function transformTemplateLiteral(node: t.TemplateLiteral): {
  message: t.StringLiteral;
  variables: t.ObjectExpression | null;
} {
  const parts: string[] = [];
  const properties: t.ObjectProperty[] = [];
  let varIndex = 0;

  for (let i = 0; i < node.quasis.length; i++) {
    // Add the cooked text from the quasi (use cooked to handle escape sequences)
    parts.push(node.quasis[i].value.cooked ?? node.quasis[i].value.raw);

    // If there's a corresponding expression, create a variable placeholder
    if (i < node.expressions.length) {
      const expr = node.expressions[i] as t.Expression;
      const key = varIndex.toString();
      parts.push(`{${key}}`);
      properties.push(t.objectProperty(t.stringLiteral(key), expr));
      varIndex++;
    }
  }

  return {
    message: t.stringLiteral(parts.join('')),
    variables: properties.length > 0 ? t.objectExpression(properties) : null,
  };
}
