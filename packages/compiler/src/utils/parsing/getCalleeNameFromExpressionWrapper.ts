import * as t from '@babel/types';
import { getCalleeNameFromExpression } from './getCalleeNameFromExpression';
/**
 * Get the callee name from an expression: ... = useGT();
 */
export function getCalleeNameFromExpressionWrapper(
  expr: t.Expression | null | undefined
): {
  namespaceName: string | null;
  functionName: string | null;
} {
  if (!expr) {
    return { namespaceName: null, functionName: null };
  }
  return getCalleeNameFromExpression(expr);
}
