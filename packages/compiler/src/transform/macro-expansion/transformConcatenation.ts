import * as t from '@babel/types';
import { deriveVariableName } from '../../utils/parsing/deriveVariableName';
import { flattenConcatenation } from '../../utils/parsing/flattenConcatenation';

/**
 * Transform a BinaryExpression with '+' operator into a normalized t() call format.
 *
 * Flattens the concatenation and converts non-string operands into
 * ICU-style variable placeholders.
 */
export function transformConcatenation(node: t.BinaryExpression): {
  message: t.StringLiteral;
  variables: t.ObjectExpression | null;
} {
  const operands = flattenConcatenation(node);
  const parts: string[] = [];
  const properties: t.ObjectProperty[] = [];
  let varIndex = 0;

  for (const operand of operands) {
    if (t.isStringLiteral(operand)) {
      parts.push(operand.value);
    } else {
      const varName = deriveVariableName(operand);
      const key = `${varIndex}v_${varName}`;
      parts.push(`{${key}}`);
      properties.push(t.objectProperty(t.stringLiteral(key), operand));
      varIndex++;
    }
  }

  return {
    message: t.stringLiteral(parts.join('')),
    variables: properties.length > 0 ? t.objectExpression(properties) : null,
  };
}
