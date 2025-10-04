import * as t from '@babel/types';

/**
 * Get the callee name from an expression: ... = useGT();
 * Rule of thumb, only call on expressions with parentheses
 */
export function getCalleeNameFromJsxExpressionParam(expr: t.Expression): {
  namespaceName: string | null;
  functionName: string | null;
} {
  // String literal case eg jsx("div", ...children) -> "div"
  if (t.isStringLiteral(expr)) {
    return { namespaceName: null, functionName: expr.value };
  }

  // Identifier case eg jsx(T, ...children) -> "T"
  if (t.isIdentifier(expr)) {
    return { namespaceName: null, functionName: expr.name };
  }

  // Member expression case eg jsx(GT.T, ...children) -> "GT.T"
  if (t.isMemberExpression(expr)) {
    if (t.isIdentifier(expr.object) && t.isIdentifier(expr.property)) {
      return {
        namespaceName: expr.object.name,
        functionName: expr.property.name,
      };
    }
  }

  return { namespaceName: null, functionName: null };
}
