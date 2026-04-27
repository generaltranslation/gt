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
 *
 * Returns errors alongside parts so callers can report extraction failures
 * without throwing during expression flattening.
 */
export function flattenExpressionToParts(
  node: t.Expression,
  tPath: NodePath
): { parts?: Part[]; errors: string[] } {
  if (t.isStringLiteral(node)) {
    return { parts: [{ type: 'static', value: node.value }], errors: [] };
  }

  if (t.isNumericLiteral(node)) {
    return {
      parts: [{ type: 'static', value: String(node.value) }],
      errors: [],
    };
  }

  if (t.isBooleanLiteral(node)) {
    return {
      parts: [{ type: 'static', value: String(node.value) }],
      errors: [],
    };
  }

  if (t.isNullLiteral(node)) {
    return { parts: [{ type: 'static', value: 'null' }], errors: [] };
  }

  if (t.isUnaryExpression(node) && node.operator === 'void') {
    return { parts: [{ type: 'dynamic', node }], errors: [] };
  }

  if (t.isTemplateLiteral(node)) {
    const parts: Part[] = [];
    const errors: string[] = [];
    for (let i = 0; i < node.quasis.length; i++) {
      const cooked = node.quasis[i].value.cooked;
      if (cooked == null) {
        errors.push('Template literal contains an invalid escape sequence');
      } else if (cooked) {
        parts.push({ type: 'static', value: cooked });
      }
      if (i < node.expressions.length) {
        const expr = node.expressions[i] as t.Expression;
        const { parts: exprParts, errors: exprErrors } =
          flattenExpressionToParts(expr, tPath);
        parts.push(...(exprParts ?? []));
        errors.push(...exprErrors);
      }
    }
    return { parts, errors };
  }

  if (t.isBinaryExpression(node) && node.operator === '+') {
    const { parts: leftParts, errors: leftErrors } = flattenExpressionToParts(
      node.left as t.Expression,
      tPath
    );
    const { parts: rightParts, errors: rightErrors } = flattenExpressionToParts(
      node.right as t.Expression,
      tPath
    );
    return {
      parts: [...(leftParts ?? []), ...(rightParts ?? [])],
      errors: [...leftErrors, ...rightErrors],
    };
  }

  if (isDeriveInvocation(node, tPath)) {
    return { parts: [{ type: 'derive', node }], errors: [] };
  }

  return { parts: [{ type: 'dynamic', node }], errors: [] };
}
