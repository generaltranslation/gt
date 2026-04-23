import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { buildTransformResult } from '../templates-and-concat/buildTransformationResult';
import { extractString } from '../templates-and-concat/extractString';

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
  const parts = extractString(path, false);
  return buildTransformResult(parts.value ?? []);
}
