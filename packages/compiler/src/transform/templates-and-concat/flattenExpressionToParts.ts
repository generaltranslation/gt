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
    return [{ type: 'static', value: 'undefined' }];
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

/**
 * Collapse consecutive static parts by concatenating their values.
 */
export function mergeAdjacentStaticParts(parts: Part[]): Part[] {
  const merged: Part[] = [];
  for (const part of parts) {
    if (
      part.type === 'static' &&
      merged.length > 0 &&
      merged[merged.length - 1].type === 'static'
    ) {
      (merged[merged.length - 1] as { type: 'static'; value: string }).value +=
        part.value;
    } else {
      merged.push(part);
    }
  }
  return merged;
}

/**
 * Converts merged parts into an AST message node and optional variables object.
 *
 * - All static → StringLiteral, no variables
 * - Has derive/dynamic → TemplateLiteral with derive expressions preserved
 *   and dynamic values extracted as {n} placeholders
 */
export function buildTransformResult(parts: Part[]): {
  message: t.StringLiteral | t.TemplateLiteral;
  variables: t.ObjectExpression | null;
} {
  const hasDerive = parts.some((p) => p.type === 'derive');

  // No derive parts: collapse everything into a StringLiteral with {n} placeholders
  if (!hasDerive) {
    const properties: t.ObjectProperty[] = [];
    let varIndex = 0;
    let message = '';
    for (const part of parts) {
      if (part.type === 'static') {
        message += part.value;
      } else {
        const key = varIndex.toString();
        message += `{${key}}`;
        properties.push(t.objectProperty(t.stringLiteral(key), part.node));
        varIndex++;
      }
    }
    return {
      message: t.stringLiteral(message),
      variables: properties.length > 0 ? t.objectExpression(properties) : null,
    };
  }

  // Has derive parts: build a TemplateLiteral with derive expressions preserved
  const quasis: t.TemplateElement[] = [];
  const expressions: t.Expression[] = [];
  const properties: t.ObjectProperty[] = [];
  let varIndex = 0;
  let quasiBuffer = '';

  function flushQuasi(tail: boolean) {
    quasis.push(
      t.templateElement({ raw: quasiBuffer, cooked: quasiBuffer }, tail)
    );
    quasiBuffer = '';
  }

  for (const part of parts) {
    if (part.type === 'static') {
      quasiBuffer += part.value;
    } else if (part.type === 'derive') {
      flushQuasi(false);
      expressions.push(part.node);
    } else {
      const key = varIndex.toString();
      quasiBuffer += `{${key}}`;
      properties.push(t.objectProperty(t.stringLiteral(key), part.node));
      varIndex++;
    }
  }

  // Final quasi (tail)
  flushQuasi(true);

  return {
    message: t.templateLiteral(quasis, expressions),
    variables: properties.length > 0 ? t.objectExpression(properties) : null,
  };
}
