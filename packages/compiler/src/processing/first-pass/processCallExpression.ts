import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformState } from '../../state/types';
import { getCalleeExprFunctionName } from '../../transform/transform';
import { isTranslationFunctionCallback } from '../../utils/constants/analysis';
import { isJsxFunction } from '../../utils/constants/analysis';
import { extractComponentNameFromJSXCall } from '../../transform/jsxUtils';
import { extractPropFromJSXCall } from '../../transform/jsxUtils';
import { isTranslationComponent } from '../../utils/constants/analysis';
import { isVariableComponent } from '../../utils/constants/analysis';
import { isBranchComponent } from '../../utils/constants/analysis';
import { checkCallExprForViolations } from '../../transform/transform';
import { trackTranslationCallback } from '../../transform/transform';

/**
 * Process call expressions to detect t() calls (FIRST PASS - Collection only)
 */
export function processCallExpression(
  path: NodePath<t.CallExpression>,
  state: TransformState
): boolean {
  const callExpr = path.node;

  // Get function name from callee - matches Rust get_callee_expr_function_name
  const functionName = getCalleeExprFunctionName(callExpr);
  if (!functionName) {
    return false;
  }

  // Check if this is a tracked translation function call
  const variable = state.importTracker.scopeTracker.getVariable(functionName);

  if (variable && variable.type !== 'other') {
    // Register the useGT/getGT as aggregators on the string collector
    const originalName = variable.canonicalName;
    const identifier = variable.identifier;

    // Detect t() calls (translation function callbacks)
    if (isTranslationFunctionCallback(originalName)) {
      if (callExpr.arguments && callExpr.arguments.length > 0) {
        const firstArg = callExpr.arguments[0];
        if (t.isArgumentPlaceholder(firstArg)) {
          return false;
        }

        // Check for violations
        checkCallExprForViolations(firstArg, functionName, state);

        // Track the t() function call
        trackTranslationCallback(callExpr, firstArg, identifier, state);
      }
    } else if (isJsxFunction(originalName)) {
      // For JSX function, process their children

      // Get the name of the component
      const componentName = extractComponentNameFromJSXCall(callExpr);
      if (!componentName) {
        return false;
      }

      // Map it back to an original name
      const translationVariable =
        state.importTracker.scopeTracker.getTranslationVariable(componentName);
      if (!translationVariable) {
        return false;
      }
      const originalName = translationVariable.canonicalName;
      const identifier = translationVariable.identifier;

      if (isTranslationComponent(originalName)) {
        // Get children
        const children = extractPropFromJSXCall(callExpr, 'children');
        if (!children) {
          return false;
        }

        // Get id & context
        const id = extractPropFromJSXCall(callExpr, 'id');
        const context = extractPropFromJSXCall(callExpr, 'context');

        // TODO: Check for violations

        // Calculate hash
        // TODO: add id & context to options
        // const { hash } = hashExpression(children, undefined);
        // if (!hash) {
        //   return false;
        // }

        // TODO: add to string collector
        // TODO: add to string collector for the t() function
      } else if (isVariableComponent(originalName)) {
      } else if (isBranchComponent(originalName)) {
      } else {
        return false;
      }
    }
  }

  return false; // This is collection pass - no transformations yet
}
