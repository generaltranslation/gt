import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { isDeriveInvocation } from '../../utils/parsing/isDeriveInvocation';

export type Part =
  | { type: 'static'; value: string }
  | { type: 'derive'; node: t.Expression }
  | { type: 'dynamic'; node: t.Expression };

/**
 * Recursively decomposes an expression tree into a flat list of typed parts.
 * Handles string/numeric/boolean/null literals, void expressions,
 * template literals, binary '+' concatenation, and derive() calls.
 */
export function flattenExpressionToParts(
  node: t.Expression,
  tPath: NodePath
): Part[] {
  if (t.isStringLiteral(node)) {
    return [{ type: 'static', value: node.value }];
  }

  if (t.isNumericLiteral(node)) {
    return [{ type: 'static', value: String(node.value) }];
  }

  if (t.isBooleanLiteral(node)) {
    return [{ type: 'static', value: String(node.value) }];
  }

  if (t.isNullLiteral(node)) {
    return [{ type: 'static', value: 'null' }];
  }

  if (t.isUnaryExpression(node) && node.operator === 'void') {
    return [{ type: 'dynamic', node }];
  }

  if (t.isTemplateLiteral(node)) {
    const parts: Part[] = [];
    for (let i = 0; i < node.quasis.length; i++) {
      const { cooked, raw } = node.quasis[i].value;
      const text = cooked ?? raw;
      if (text) {
        parts.push({ type: 'static', value: text });
      }
      if (i < node.expressions.length) {
        const expr = node.expressions[i] as t.Expression;
        parts.push(...flattenExpressionToParts(expr, tPath));
      }
    }
    return parts;
  }

  if (t.isBinaryExpression(node) && node.operator === '+') {
    return [
      ...flattenExpressionToParts(node.left as t.Expression, tPath),
      ...flattenExpressionToParts(node.right as t.Expression, tPath),
    ];
  }

  if (isDeriveInvocation(node, tPath)) {
    return [{ type: 'derive', node }];
  }

  return [{ type: 'dynamic', node }];
}
