import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import {
  flattenExpressionToParts,
  mergeAdjacentStaticParts,
  buildTransformResult,
} from '../templates-and-concat/flattenExpressionToParts';

/**
 * Converts template literal quasis and expressions into an ICU-style message
 * string with numeric variable placeholders ({0}, {1}, etc.).
 *
 * Recursively simplifies nested static expressions (string literals,
 * nested templates) and preserves derive() calls as template expressions.
 */
export function transformTemplateLiteral(path: NodePath<t.TemplateLiteral>): {
  message: t.StringLiteral | t.TemplateLiteral;
  variables: t.ObjectExpression | null;
} {
  const parts = flattenExpressionToParts(path.node, path);
  const merged = mergeAdjacentStaticParts(parts);
  return buildTransformResult(merged);
}
