import * as t from '@babel/types';
import { GT_OTHER_FUNCTIONS } from '../../utils/constants/gt/constants';
import { TransformState } from '../../state/types';
import { getCalleeNameFromExpression } from '../../utils/parsing/getCalleeNameFromExpression';
import { getTrackedVariable } from '../getTrackedVariable';

/**
 * Whether an expression is one derive() call with one argument. <T> reads
 * derive() only as its whole context, so text joined to it is not accepted.
 */
export function isDeriveCall(
  expr: t.Expression,
  state: TransformState
): boolean {
  if (!t.isCallExpression(expr)) return false;
  const { namespaceName, functionName } = getCalleeNameFromExpression(expr);
  const { canonicalName, type } = getTrackedVariable(
    state.scopeTracker,
    namespaceName,
    functionName
  );
  return (
    type === 'generaltranslation' &&
    canonicalName === GT_OTHER_FUNCTIONS.derive &&
    expr.arguments.length === 1 &&
    t.isExpression(expr.arguments[0])
  );
}
