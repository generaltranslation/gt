import * as t from '@babel/types';

/**
 * Attempt to resolve an expression to a static string at compile time.
 * Handles string literals, template literals, binary '+' concatenation,
 * nested combinations, and numeric/boolean/null literals coerced to string.
 *
 * Returns the resolved string, or undefined if the expression contains
 * any dynamic content (variables, function calls, etc.).
 */
export function resolveStaticExpression(expr: t.Expression): {
  errors: string[];
  value?: string;
} {
  if (t.isStringLiteral(expr)) {
    return { errors: [], value: expr.value };
  }

  if (t.isNumericLiteral(expr)) {
    return { errors: [], value: String(expr.value) };
  }

  if (t.isBooleanLiteral(expr)) {
    return { errors: [], value: String(expr.value) };
  }

  if (t.isNullLiteral(expr)) {
    return { errors: [], value: 'null' };
  }

  if (t.isTemplateLiteral(expr)) {
    let result = '';
    for (let i = 0; i < expr.quasis.length; i++) {
      const { cooked, raw } = expr.quasis[i].value;
      result += cooked ?? raw;
      if (i < expr.expressions.length) {
        const resolved = resolveStaticExpression(
          expr.expressions[i] as t.Expression
        );
        if (resolved.errors.length || resolved.value == null) return resolved;
        result += resolved.value ?? '';
      }
    }
    return { errors: [], value: result };
  }

  if (t.isBinaryExpression(expr) && expr.operator === '+') {
    const left = resolveStaticExpression(expr.left as t.Expression);
    if (left.errors.length || left.value == null) return left;
    const right = resolveStaticExpression(expr.right as t.Expression);
    if (right.errors.length || right.value == null) return right;
    return { errors: [], value: (left.value ?? '') + (right.value ?? '') };
  }

  return { errors: ['Expression is not a static string'] };
}
