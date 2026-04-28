import * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';
import { flattenExpressionToParts } from './flattenExpressionToParts';

/**
 * Attempt to resolve an expression to a static string at compile time.
 * Handles string literals, template literals, binary '+' concatenation,
 * nested combinations, and numeric/boolean/null literals coerced to string.
 *
 * Returns the resolved string, or undefined if the expression contains
 * any dynamic content (variables, function calls, etc.).
 */
export function resolveStaticExpression(exprPath: NodePath<t.Expression>): {
  errors: string[];
  value?: string;
} {
  const { parts, errors } = flattenExpressionToParts(exprPath);
  if (errors.length > 0) return { errors };

  let value = '';
  for (const part of parts) {
    // Signal derive by returning undefined
    if (part.type === 'derive') {
      return { errors: [], value: undefined };
    } else if (part.type !== 'static') {
      return { errors: ['Expression is not a static string'] };
    }
    value += part.value;
  }

  return { errors: [], value };
}
