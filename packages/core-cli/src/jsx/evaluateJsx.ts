import * as t from '@babel/types';

const MEANINGFUL_REGEX = /[\p{L}\p{N}]/u;

/**
 * Checks if a node is meaningful. Does not recurse into children.
 * @param node - The node to check
 * @returns Whether the node is meaningful
 */
export function isMeaningful(node: t.Node): boolean {
  if (t.isStringLiteral(node) || t.isJSXText(node)) {
    return MEANINGFUL_REGEX.test(node.value);
  }
  // Handle template literals without expressions
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
    return MEANINGFUL_REGEX.test(node.quasis[0].value.raw);
  }
  if (t.isJSXExpressionContainer(node)) {
    const value = isStaticExpression(node.expression);
    if (value.isStatic && value.value) {
      return MEANINGFUL_REGEX.test(value.value);
    }
  }
  if (t.isBinaryExpression(node)) {
    if (node.operator === '+') {
      return isMeaningful(node.left) || isMeaningful(node.right);
    }
  }
  return false;
}

/**
 * Checks if an expression is static (does not contain any variables which could change at runtime).
 * @param expr - The expression to check
 * @returns An object containing the result of the static check
 */
export function isStaticExpression(expr: t.Expression | t.JSXEmptyExpression): {
  isStatic: boolean;
  value?: string;
} {
  // Handle empty expressions
  if (t.isJSXEmptyExpression(expr)) {
    return { isStatic: true, value: '' };
  }

  // Handle direct string literals
  if (t.isStringLiteral(expr)) {
    return { isStatic: true, value: expr.value };
  }

  // Handle template literals without expressions
  if (t.isTemplateLiteral(expr) && expr.expressions.length === 0) {
    return { isStatic: true, value: expr.quasis[0].value.raw };
  }

  // Handle binary expressions (string concatenation)
  if (t.isBinaryExpression(expr)) {
    // Only handle string concatenation
    if (expr.operator !== '+') {
      return { isStatic: false };
    }

    // Type guard to ensure we only process Expression types
    if (t.isExpression(expr.left) && t.isExpression(expr.right)) {
      const left = isStaticExpression(expr.left);
      const right = isStaticExpression(expr.right);

      if (
        left.isStatic &&
        right.isStatic &&
        left.value !== undefined &&
        right.value !== undefined
      ) {
        return { isStatic: true, value: left.value + right.value };
      }
    }
  }

  // Handle parenthesized expressions
  if (t.isParenthesizedExpression(expr)) {
    return isStaticExpression(expr.expression);
  }

  // Handle numeric literals by converting them to strings
  if (t.isNumericLiteral(expr)) {
    return { isStatic: true, value: String(expr.value) };
  }

  // Handle boolean literals by converting them to strings
  if (t.isBooleanLiteral(expr)) {
    return { isStatic: true, value: String(expr.value) };
  }

  // Handle null literal
  if (t.isNullLiteral(expr)) {
    return { isStatic: true, value: 'null' };
  }

  // Not a static expression
  return { isStatic: false };
}

export function isStaticValue(
  expr: t.Expression | t.JSXEmptyExpression
): boolean {
  if (t.isStringLiteral(expr)) {
    return true;
  }
  if (t.isNumericLiteral(expr)) {
    return true;
  }
  if (t.isTemplateLiteral(expr)) {
    return true;
  }
  return false;
}
