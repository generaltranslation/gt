import * as t from '@babel/types';
import { flattenConcatenation } from '../../utils/parsing/flattenConcatenation';
import { NodePath } from '@babel/traverse';
import { isDeriveInvocation } from '../../utils/parsing/isDeriveInvocation';

/**
 * Transform a BinaryExpression with '+' operator into a normalized t() call format.
 *
 * Flattens the concatenation and converts non-string operands into
 * ICU-style variable placeholders.
 */
export function transformConcatenation(path: NodePath<t.BinaryExpression>): {
  message: t.Expression | t.BinaryExpression;
  variables: t.ObjectExpression | null;
} {
  const operands = flattenConcatenation(path);
  const parts: t.Expression[] = [];
  const properties: t.ObjectProperty[] = [];
  let varIndex = 0;

  for (const operand of operands) {
    if (operand.isStringLiteral()) {
      parts.push(operand.node);
    } else if (
      operand.isTemplateLiteral() &&
      // TODO: create a more sophisticated logic for parsing statically analyzable contents
      operand.node.expressions.length === 0
    ) {
      parts.push(operand.node);
    } else if (isDeriveInvocation(operand.node, path)) {
      parts.push(operand.node);
    } else {
      const key = varIndex.toString();
      parts.push(t.stringLiteral(`{${key}}`));
      properties.push(t.objectProperty(t.stringLiteral(key), operand.node));
      varIndex++;
    }
  }

  return {
    message: parts.length < 2 ? parts[0] : createBinaryConcatenation(parts),
    variables: properties.length > 0 ? t.objectExpression(properties) : null,
  };
}

// ----- Helper Functions ----- //

/**
 * Create a binary concatenation expression from a list of expressions.
 * @param {NodePath<t.Expression>[]} expressions - The list of expressions to concatenate
 * @returns {t.BinaryExpression} The binary concatenation expression
 *
 * @important This must have a length of at least 2
 */
function createBinaryConcatenation(
  expressions: t.Expression[],
  index: number = 0
): t.BinaryExpression {
  return t.binaryExpression(
    '+',
    expressions[index],
    index + 1 === expressions.length - 1
      ? expressions[index + 1]
      : createBinaryConcatenation(expressions, index + 1)
  );
}
