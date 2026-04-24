import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { extractString } from '../templates-and-concat/extractString';
import { buildTransformResult } from '../templates-and-concat/buildTransformationResult';

/**
 * Transform a BinaryExpression with '+' operator into a normalized t() call format.
 *
 * Recursively flattens the concatenation tree and simplifies static parts,
 * converting dynamic operands into ICU-style variable placeholders.
 */
export function transformConcatenation(path: NodePath<t.BinaryExpression>): {
  message: t.StringLiteral | t.TemplateLiteral;
  variables: t.ObjectExpression | null;
} {
  const parts = extractString(path, false);
  return buildTransformResult(parts.value ?? []);
}
