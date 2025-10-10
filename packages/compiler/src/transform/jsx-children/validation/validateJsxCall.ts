import { TransformState } from '../../../state/types';
import * as t from '@babel/types';
import {
  createErrorLocation,
  generateDynamicContentErrorMessage,
} from '../../../utils/errors';
import { getCalleeNameFromExpression } from '../../../utils/parsing/getCalleeNameFromExpression';
import { isReactFunction } from '../../../utils/constants/react/helpers';
/**
 * Given a CallExpression, validates that it is a valid JSX call
 */
export function validateJsxCall(
  callExpr: t.CallExpression,
  state: TransformState
): string[] {
  // Validate that this is a jsx call
  const { functionName: jsxFunctionName } =
    getCalleeNameFromExpression(callExpr);
  if (!jsxFunctionName) {
    return [
      generateDynamicContentErrorMessage() + createErrorLocation(callExpr),
    ];
  }
  // Check that this is a jsx function
  const scopedVar = state.scopeTracker.getVariable(jsxFunctionName);
  if (
    !scopedVar ||
    scopedVar.type !== 'react' ||
    !isReactFunction(scopedVar.canonicalName)
  ) {
    return [
      generateDynamicContentErrorMessage(jsxFunctionName + '()') +
        createErrorLocation(callExpr),
    ];
  }
  return [];
}
