import * as t from '@babel/types';

/**
 * Get the callee name from an expression: ... = useGT();
 */
export function getCalleeNameFromExpression(expr: t.Expression): {
  namespaceName: string | null;
  functionName: string | null;
} {
  // If its an await expression, unwrap it
  if (t.isAwaitExpression(expr)) {
    return getCalleeNameFromExpression(expr.argument);
  }

  // Check that this is a call expression eg: func()
  if (!t.isCallExpression(expr)) {
    return { namespaceName: null, functionName: null };
  }

  // Get the callee name
  const calleeName = expr.callee;

  // Simple case: ... = useGT();
  if (t.isIdentifier(calleeName)) {
    return { namespaceName: null, functionName: calleeName.name };
  }

  // Member expression: ... = GT.useGT();
  if (t.isMemberExpression(calleeName)) {
    if (
      t.isIdentifier(calleeName.object) &&
      t.isIdentifier(calleeName.property)
    ) {
      return {
        namespaceName: calleeName.object.name,
        functionName: calleeName.property.name,
      };
    }
  }

  return { namespaceName: null, functionName: null };
}
