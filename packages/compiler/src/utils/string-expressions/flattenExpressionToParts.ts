import * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';
import { isDeriveInvocation } from '../parsing/isDeriveInvocation';
import { ResolutionNode } from '../multiplication/types';

export type Part =
  | { type: 'static'; value: string }
  | { type: 'derive'; node: t.Expression }
  | { type: 'dynamic'; node: t.Expression };

type FlattenExpressionResult = {
  parts: ResolutionNode<Part>[];
  errors: string[];
};

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
  exprPath: NodePath<t.Expression>
): FlattenExpressionResult {
  const expr = exprPath.node;
  const scope = exprPath.scope;

  // gt('Hello, World!')
  if (t.isStringLiteral(expr)) {
    return { parts: [{ type: 'static', value: expr.value }], errors: [] };
  }

  // gt(123)
  if (t.isNumericLiteral(expr)) {
    return {
      parts: [{ type: 'static', value: String(expr.value) }],
      errors: [],
    };
  }

  // gt(true)
  if (t.isBooleanLiteral(expr)) {
    return {
      parts: [{ type: 'static', value: String(expr.value) }],
      errors: [],
    };
  }

  // gt(null)
  if (t.isNullLiteral(expr)) {
    return { parts: [{ type: 'static', value: 'null' }], errors: [] };
  }

  // gt(void 0)
  if (t.isUnaryExpression(expr) && expr.operator === 'void') {
    return { parts: [{ type: 'dynamic', node: expr }], errors: [] };
  }

  // gt(`Hello, ${name}!`)
  if (t.isTemplateLiteral(expr)) {
    const result: FlattenExpressionResult = { parts: [], errors: [] };
    for (let i = 0; i < expr.quasis.length; i++) {
      const cooked = expr.quasis[i].value.cooked;
      if (cooked == null) {
        result.errors.push(
          'Template literal contains an invalid escape sequence'
        );
        return result;
      } else if (cooked) {
        result.parts.push({ type: 'static', value: cooked });
      }
      if (i < expr.expressions.length) {
        const exprPathIndex = exprPath.get('expressions')[i];
        if (!exprPathIndex.isExpression()) {
          result.errors.push('Expression is not a valid expression');
          return result;
        }
        const expressionResult = flattenExpressionToParts(exprPathIndex);
        result.parts.push(...expressionResult.parts);
        result.errors.push(...expressionResult.errors);
      }
    }
    return result;
  }

  // gt('Hello, ' + name + '!')
  if (t.isBinaryExpression(expr) && expr.operator === '+') {
    const leftPath = exprPath.get('left');
    if (!leftPath.isExpression()) {
      return { parts: [], errors: ['Expression is not a valid expression'] };
    }
    const { parts: leftParts, errors: leftErrors } =
      flattenExpressionToParts(leftPath);
    const rightPath = exprPath.get('right');
    if (!rightPath.isExpression()) {
      return { parts: [], errors: ['Expression is not a valid expression'] };
    }
    const { parts: rightParts, errors: rightErrors } =
      flattenExpressionToParts(rightPath);
    return {
      parts: [...leftParts, ...rightParts],
      errors: [...leftErrors, ...rightErrors],
    };
  }

  // gt(derive(() => 'Hello, World!'))
  if (scope && isDeriveInvocation(expr, scope)) {
    return { parts: [{ type: 'derive', node: expr }], errors: [] };
  }

  // gt(name)
  return { parts: [{ type: 'dynamic', node: expr }], errors: [] };
}
