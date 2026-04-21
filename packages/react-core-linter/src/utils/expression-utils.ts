/**
 * General-purpose AST expression analysis helpers.
 * Shared predicates for inspecting JSX expressions.
 */

import { TSESTree } from '@typescript-eslint/utils';

/**
 * Returns the raw string value of a static string expression
 * (string literal or template literal without interpolation),
 * or null for anything else.
 */
export function staticStringValue(expr: TSESTree.Expression): string | null {
  if (
    expr.type === TSESTree.AST_NODE_TYPES.Literal &&
    typeof expr.value === 'string'
  )
    return expr.value;
  if (
    expr.type === TSESTree.AST_NODE_TYPES.TemplateLiteral &&
    expr.expressions.length === 0
  )
    return expr.quasis[0].value.raw;
  return null;
}

/**
 * Recursively checks whether an expression contains content that
 * a translator would need to see — string literals, static template
 * literals, JSX elements, or JSX fragments. Recurses into nested
 * conditionals and logical AND expressions.
 */
export function hasTranslatableContent(expr: TSESTree.Expression): boolean {
  switch (expr.type) {
    case TSESTree.AST_NODE_TYPES.Literal:
      return typeof expr.value === 'string';
    case TSESTree.AST_NODE_TYPES.TemplateLiteral:
      return expr.expressions.length === 0;
    case TSESTree.AST_NODE_TYPES.JSXElement:
    case TSESTree.AST_NODE_TYPES.JSXFragment:
      return true;
    case TSESTree.AST_NODE_TYPES.ConditionalExpression:
      return (
        hasTranslatableContent(expr.consequent) ||
        hasTranslatableContent(expr.alternate)
      );
    case TSESTree.AST_NODE_TYPES.LogicalExpression:
      return expr.operator === '&&' && hasTranslatableContent(expr.right);
    default:
      return false;
  }
}

/**
 * Type guard: ConditionalExpression where at least one branch
 * has translatable content (eligible for Branch wrapping).
 */
export function isBranchableConditional(
  expr: TSESTree.Expression
): expr is TSESTree.ConditionalExpression {
  return (
    expr.type === TSESTree.AST_NODE_TYPES.ConditionalExpression &&
    hasTranslatableContent(expr)
  );
}

/**
 * Type guard: LogicalExpression with && where the right operand
 * has translatable content (eligible for Branch wrapping).
 */
export function isBranchableLogicalAnd(
  expr: TSESTree.Expression
): expr is TSESTree.LogicalExpression {
  return (
    expr.type === TSESTree.AST_NODE_TYPES.LogicalExpression &&
    expr.operator === '&&' &&
    hasTranslatableContent(expr.right)
  );
}
