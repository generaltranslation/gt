import * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';
import { isDeriveInvocation } from '../parsing/isDeriveInvocation';

export type Part =
  | { type: 'static'; value: string }
  | { type: 'derive'; node: t.Expression }
  | { type: 'dynamic'; node: t.Expression };

type FlattenExpressionResult = { parts: Part[]; errors: string[] };

/**
 * Recursively decomposes an expression tree into a flat list of typed parts.
 * Handles string/numeric/boolean/null literals, void expressions,
 * template literals, and binary '+' concatenation. When a NodePath is
 * provided, imported derive() calls are preserved as derive parts.
 *
 * Returns errors alongside parts so callers can report extraction failures
 * without throwing during expression flattening.
 */
export function flattenExpressionToParts(
  node: t.Expression,
  tPath?: NodePath
): FlattenExpressionResult {
  // gt('Hello, World!')
  if (t.isStringLiteral(node)) {
    return { parts: [{ type: 'static', value: node.value }], errors: [] };
  }

  // gt(123)
  if (t.isNumericLiteral(node)) {
    return {
      parts: [{ type: 'static', value: String(node.value) }],
      errors: [],
    };
  }

  // gt(true)
  if (t.isBooleanLiteral(node)) {
    return {
      parts: [{ type: 'static', value: String(node.value) }],
      errors: [],
    };
  }

  // gt(null)
  if (t.isNullLiteral(node)) {
    return { parts: [{ type: 'static', value: 'null' }], errors: [] };
  }

  // gt(void 0)
  if (t.isUnaryExpression(node) && node.operator === 'void') {
    return { parts: [{ type: 'dynamic', node }], errors: [] };
  }

  // gt(`Hello, ${name}!`)
  if (t.isTemplateLiteral(node)) {
    const result: FlattenExpressionResult = { parts: [], errors: [] };
    for (let i = 0; i < node.quasis.length; i++) {
      const cooked = node.quasis[i].value.cooked;
      if (cooked == null) {
        result.errors.push(
          'Template literal contains an invalid escape sequence'
        );
        return result;
      } else if (cooked) {
        result.parts.push({ type: 'static', value: cooked });
      }
      if (i < node.expressions.length) {
        const expr = node.expressions[i] as t.Expression;
        const expressionResult = flattenExpressionToParts(expr, tPath);
        result.parts.push(...expressionResult.parts);
        result.errors.push(...expressionResult.errors);
      }
    }
    return result;
  }

  // gt('Hello, ' + name + '!')
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
      parts: [...leftParts, ...rightParts],
      errors: [...leftErrors, ...rightErrors],
    };
  }

  // gt(derive(() => 'Hello, World!'))
  if (tPath && isDeriveInvocation(node, tPath)) {
    return { parts: [{ type: 'derive', node }], errors: [] };
  }

  // gt(name)
  return { parts: [{ type: 'dynamic', node }], errors: [] };
}
