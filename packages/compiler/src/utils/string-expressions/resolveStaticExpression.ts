import * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';
import { flattenExpressionToParts } from './flattenExpressionToParts';
import { multiply } from '../multiplication/multiply';

/**
 * Attempt to resolve an expression to static string values at compile time.
 * Handles string literals, template literals, binary '+' concatenation,
 * nested combinations, and numeric/boolean/null literals coerced to string.
 *
 * Returns all resolved values, or undefined if the expression contains
 * dynamic or derive content.
 */
export function resolveStaticExpression(exprPath: NodePath<t.Expression>): {
  errors: string[];
  values?: string[];
  kind?: 'dynamic-expression';
} {
  const { parts, errors } = flattenExpressionToParts(exprPath);
  if (errors.length > 0) return { errors };
  const variants = multiply(parts);

  const values: string[] = [];
  for (const variant of variants) {
    let value = '';
    for (const part of variant) {
      // Signal derive by returning undefined
      if (part.type === 'derive') {
        return { errors: [], values: undefined };
      } else if (part.type !== 'static') {
        return {
          kind: 'dynamic-expression',
          errors: ['Expression is not a static string'],
        };
      }
      value += part.value;
    }
    values.push(value);
  }

  return { errors: [], values };
}
