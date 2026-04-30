import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { flattenExpressionToParts } from '../../utils/string-expressions/flattenExpressionToParts';
import { buildTransformResult } from '../../utils/string-expressions/buildTransformationResult';
import { multiply } from '../../utils/multiplication/multiply';

/**
 * Converts template literal quasis and expressions into an ICU-style message
 * string with numeric variable placeholders ({0}, {1}, etc.).
 *
 * Recursively simplifies nested static expressions (string literals,
 * nested templates) and preserves derive() calls as template expressions.
 */
export function transformTemplateLiteral(path: NodePath<t.TemplateLiteral>): {
  content: {
    message: t.StringLiteral | t.TemplateLiteral;
    variables: t.ObjectExpression | null;
  }[];
  errors: string[];
} {
  const { parts, errors } = flattenExpressionToParts(path);
  if (errors.length > 0) {
    return { errors, content: [] };
  }
  const variants = multiply(parts);

  const content = variants.map(buildTransformResult);

  return {
    content,
    errors: [],
  };
}
