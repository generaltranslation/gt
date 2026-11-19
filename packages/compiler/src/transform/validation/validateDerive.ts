import * as t from '@babel/types';
import { GT_OTHER_FUNCTIONS } from '../../utils/constants/gt/constants';
import { TransformState } from '../../state/types';
import { getCalleeNameFromExpression } from '../../utils/parsing/getCalleeNameFromExpression';
import { getTrackedVariable } from '../getTrackedVariable';

/**
 * Validates if an expression uses the derive() function correctly
 */
export function validateDerive(
  expr: t.Expression,
  state: TransformState,
  errors: string[]
): { errors: string[] } {
  if (!expr) {
    errors.push('Expression is empty');
    return { errors };
  }

  // 1. Direct call: derive(node)
  if (t.isCallExpression(expr)) {
    // Find the canonical function name
    const { namespaceName, functionName } = getCalleeNameFromExpression(expr);
    // Get the canonical function name
    const { canonicalName, type } = getTrackedVariable(
      state.scopeTracker,
      namespaceName,
      functionName
    );
    if (!canonicalName) {
      errors.push('Expression does not use an allowed call expression');
      return { errors };
    }
    // Validate the function is actually the GT derive function
    if (
      type !== 'generaltranslation' ||
      canonicalName !== GT_OTHER_FUNCTIONS.derive
    ) {
      errors.push('Expression does not use an allowed call expression');
      return { errors };
    }
    // Validate that the call expression has exactly one argument and the argument is a call expression
    validateDeriveCallExpression(expr, errors);
    return { errors };
  }

  // 2. String concatenation: "Hello there " + derive(getName())
  if (t.isBinaryExpression(expr) && expr.operator === '+') {
    if (!t.isExpression(expr.left) || !t.isExpression(expr.right)) {
      errors.push('Operands must be expressions');
      return { errors };
    }
    validateDerive(expr.right, state, errors);
    validateDerive(expr.left, state, errors);
    return { errors };
  }

  // 3. Template literal: `Hello there ${derive(getName())}` or `static text`
  if (t.isTemplateLiteral(expr)) {
    if (expr.expressions.length === 0) {
      return { errors };
    }
    if (
      !expr.expressions.some(
        (expression) =>
          t.isExpression(expression) &&
          validateDerive(expression, state, errors).errors.length === 0
      )
    ) {
      errors.push('Expression does not use an allowed call expression');
    }
    return {
      errors,
    };
  }

  // 4. Static literals (string, number, boolean, null)
  if (t.isStringLiteral(expr)) {
    return { errors };
  }

  if (t.isNumericLiteral(expr)) {
    return { errors };
  }

  if (t.isBooleanLiteral(expr)) {
    return { errors };
  }

  if (t.isNullLiteral(expr)) {
    return { errors };
  }

  // Fallthrough: expression type not supported (e.g., plain identifiers/variables)
  errors.push('Variables are not allowed');
  return { errors };
}

/**
 * Takes in a call expression to check if:
 * - it has exactly one argument
 * - the argument is a call expression
 * Example: derive(getName())
 */
function validateDeriveCallExpression(
  expr: t.CallExpression,
  errors: string[]
): {
  errors: string[];
} {
  // Validate that the function has 1 argument
  if (expr.arguments.length !== 1) {
    errors.push('derive() must have one argument');
    return { errors };
  }
  const [onlyArg] = expr.arguments;

  // Await expression: derive(await ...)
  if (t.isAwaitExpression(onlyArg)) {
    // Validate that the awaited expression is a call expression
    if (!t.isCallExpression(onlyArg.argument)) {
      errors.push('derive() must have a call expression as the argument');
      return { errors };
    }
    // Valid: derive(await someFunction())
    return { errors };
  }

  // Validate that the argument is a call expression
  if (!t.isCallExpression(onlyArg)) {
    errors.push('derive() must have a call expression as the argument');
    return { errors };
  }

  return { errors };
}
