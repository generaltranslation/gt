import * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';
import {
  flattenExpressionToParts,
  type FlattenExpressionError,
} from './flattenExpressionToParts';
import { multiply } from '../../utils/multiplication/multiply';

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
