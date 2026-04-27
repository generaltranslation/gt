import * as t from '@babel/types';
import { flattenExpressionToParts } from './flattenExpressionToParts';

/**
 * Attempt to resolve an expression to a static string at compile time.
 * Handles string literals, template literals, binary '+' concatenation,
 * nested combinations, and numeric/boolean/null literals coerced to string.
 *
 * Returns the resolved string, or undefined if the expression contains
 * any dynamic content (variables, function calls, etc.).
 */
export function resolveStaticExpression(expr: t.Expression): {
  errors: string[];
  value?: string;
} {
  const { parts, errors } = flattenExpressionToParts(expr);
  if (errors.length > 0) return { errors };

  let value = '';
  for (const part of parts) {
    // Signal derive by returning undefined
    if (part.type === 'derive') {
      return { errors: [], value: undefined };
    }
    if (part.type !== 'static') {
      return { errors: ['Expression is not a static string'] };
    }
    value += part.value;
  }

  return { errors: [], value };
}
