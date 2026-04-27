import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { flattenExpressionToParts } from '../../utils/string-expressions/flattenExpressionToParts';
import { mergeAdjacentStaticParts } from '../../utils/string-expressions/mergeAdjacentStaticParts';
import { buildTransformResult } from '../../utils/string-expressions/buildTransformationResult';

/**
 * Converts template literal quasis and expressions into an ICU-style message
 * string with numeric variable placeholders ({0}, {1}, etc.).
 *
 * Recursively simplifies nested static expressions (string literals,
 * nested templates) and preserves derive() calls as template expressions.
 */
export function transformTemplateLiteral(path: NodePath<t.TemplateLiteral>): {
  message?: t.StringLiteral | t.TemplateLiteral;
  variables?: t.ObjectExpression | null;
  errors: string[];
} {
  const { parts, errors } = flattenExpressionToParts(path.node, path);
  if (errors.length > 0) {
    return { errors };
  }
  const merged = mergeAdjacentStaticParts(parts);
  return {
    ...buildTransformResult(merged),
    errors: [],
  };
}
