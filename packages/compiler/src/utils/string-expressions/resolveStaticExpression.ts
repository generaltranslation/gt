import * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';
import {
  flattenExpressionToParts,
  type FlattenExpressionError,
} from './flattenExpressionToParts';
import { multiply } from '../multiplication/multiply';

export type ResolveStaticExpressionError =
  | FlattenExpressionError
  | {
      kind: 'dynamic-expression';
      message: string;
    };

const DYNAMIC_EXPRESSION_ERROR: ResolveStaticExpressionError = {
  kind: 'dynamic-expression',
  message: 'Expression is not a static string',
};

/**
 * Attempt to resolve an expression to static string values at compile time.
 * Handles string literals, template literals, binary '+' concatenation,
 * nested combinations, and numeric/boolean/null literals coerced to string.
 *
 * Returns all resolved values, or undefined if the expression contains
 * dynamic or derive content.
 */
export function resolveStaticExpression(exprPath: NodePath<t.Expression>): {
  errors: ResolveStaticExpressionError[];
  values?: string[];
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
        return { errors: [DYNAMIC_EXPRESSION_ERROR] };
      }
      value += part.value;
    }
    values.push(value);
  }

  return { errors: [], values };
}
