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

function isStaticPart(
  part: ResolutionNode<Part> | undefined
): part is Extract<Part, { type: 'static' }> {
  return part != null && 'type' in part && part.type === 'static';
}

function appendPart(
  parts: ResolutionNode<Part>[],
  part: ResolutionNode<Part>
): void {
  const lastPart = parts[parts.length - 1];
  if (isStaticPart(lastPart) && isStaticPart(part)) {
    lastPart.value += part.value;
    return;
  }
  parts.push(part);
}

function appendParts(
  parts: ResolutionNode<Part>[],
  nextParts: ResolutionNode<Part>[]
): void {
  for (const part of nextParts) {
    appendPart(parts, part);
  }
}

/**
 * Recursively decomposes an expression tree into a flat list of typed parts.
 * Handles string/numeric/boolean/null literals, void expressions,
 * template literals, and binary '+' concatenation. When a NodePath is
 * provided, imported derive() calls are preserved as derive parts.
 *
 * Returns errors alongside parts so callers can report extraction failures
 * without throwing during expression flattening. Adjacent static parts are
 * coalesced before returning.
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
        appendPart(result.parts, { type: 'static', value: cooked });
      }
      if (i < expr.expressions.length) {
        const exprPathIndex = exprPath.get('expressions')[i];
        if (!exprPathIndex.isExpression()) {
          result.errors.push('Expression is not a valid expression');
          return result;
        }
        const expressionResult = flattenExpressionToParts(exprPathIndex);
        appendParts(result.parts, expressionResult.parts);
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
    const parts: ResolutionNode<Part>[] = [];
    appendParts(parts, leftParts);
    appendParts(parts, rightParts);
    return {
      parts,
      errors: [...leftErrors, ...rightErrors],
    };
  }

  // gt(derive(() => 'Hello, World!'))
  if (isDeriveInvocation(expr, scope)) {
    return { parts: [{ type: 'derive', node: expr }], errors: [] };
  }

  // gt(name)
  return { parts: [{ type: 'dynamic', node: expr }], errors: [] };
}
