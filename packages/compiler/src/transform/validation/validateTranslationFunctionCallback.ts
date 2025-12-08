import * as t from '@babel/types';
import {
  GT_OTHER_FUNCTIONS,
  USEGT_CALLBACK_OPTIONS,
} from '../../utils/constants/gt/constants';
import { TransformState } from '../../state/types';
import { getCalleeNameFromExpression } from '../../utils/parsing/getCalleeNameFromExpression';
import { getTrackedVariable } from '../getTrackedVariable';

/**
 * Validate useGT_callback / getGT_callback
 * - first argument must be a string literal
 * - second argument, if present, $id field + $context field must be a string literal
 */
export function validateUseGTCallback(
  callExpr: t.CallExpression,
  state: TransformState
): {
  errors: string[];
  content?: string;
  context?: string;
  hash?: string;
  id?: string;
} {
  const errors: string[] = [];

  // Validate that the function has at least 1 argument
  if (callExpr.arguments.length < 1) {
    errors.push(
      'useGT_callback / getGT_callback must have at least 1 argument'
    );
    return { errors };
  }

  // Validate first argument
  if (!t.isExpression(callExpr.arguments[0])) {
    errors.push(
      'useGT_callback / getGT_callback must use a string literal or declareStatic call as the first argument. Variable content is not allowed.'
    );
    return { errors };
  }

  // Get content and validate that it is a string literal
  const validatedContent = validateExpressionIsStringLiteral(
    callExpr.arguments[0]
  );
  const content = validatedContent.value;

  if (content === undefined) {
    // expression is not a string literal. Check if it contains a declareStatic function invocation
    validateDeclareStatic(callExpr.arguments[0], state, errors);
    if (errors.length > 0) {
      errors.push(...validatedContent.errors);
      errors.push(
        'useGT_callback / getGT_callback must use a string literal or declareStatic call as the first argument. Variable content is not allowed.'
      );
      return { errors };
    }
  }
  // Validate second argument
  let context: string | undefined;
  let id: string | undefined;
  let hash: string | undefined;
  if (callExpr.arguments.length === 1) {
    return { errors, content };
  }
  if (t.isObjectExpression(callExpr.arguments[1])) {
    const contextProperty = validatePropertyFromObjectExpression(
      callExpr.arguments[1],
      USEGT_CALLBACK_OPTIONS.$context
    );
    errors.push(...contextProperty.errors);
    context = contextProperty.value;
    const idProperty = validatePropertyFromObjectExpression(
      callExpr.arguments[1],
      USEGT_CALLBACK_OPTIONS.$id
    );
    errors.push(...idProperty.errors);
    id = idProperty.value;
    const hashProperty = validatePropertyFromObjectExpression(
      callExpr.arguments[1],
      USEGT_CALLBACK_OPTIONS.$_hash
    );
    errors.push(...hashProperty.errors);
    hash = hashProperty.value;
  }

  return { errors, content, context, id, hash };
}

/**
 * Validate useTranslations_callback / getTranslations_callback
 * - always valid (arguments can be dynamic)
 */
// eslint-disable-next-line no-unused-vars
export function validateUseTranslationsCallback(_callExpr: t.CallExpression): {
  errors: string[];
} {
  const errors: string[] = [];
  return { errors };
}

/**
 * Validate useMessages_callback / getMessages_callback
 * - always valid
 */
// eslint-disable-next-line no-unused-vars
export function validateUseMessagesCallback(_callExpr: t.CallExpression): {
  errors: string[];
} {
  const errors: string[] = [];
  return { errors };
}

/* =============================== */
/* Helper Functions */
/* =============================== */

/**
 * Validate a property from an object expression
 * @param objExpr - The object expression to validate
 * @param name - The name of the property to validate
 * @returns The validated property
 */
function validatePropertyFromObjectExpression(
  objExpr: t.ObjectExpression,
  name: string
): { errors: string[]; value?: string } {
  const result: { errors: string[]; value?: string } = { errors: [] };
  let value: t.ObjectProperty | undefined;
  for (const property of objExpr.properties) {
    if (!t.isObjectProperty(property)) {
      continue;
    }
    if (t.isIdentifier(property.key) && property.key.name === name) {
      value = property;
      break;
    }
    if (t.isStringLiteral(property.key) && property.key.value === name) {
      value = property;
      break;
    }
  }

  // return result if no value found
  if (!value) {
    return result;
  }

  // validate value
  if (!t.isExpression(value.value)) {
    result.errors.push(
      `useGT_callback / getGT_callback must use a string literal for its ${name} field. Variable content is not allowed.`
    );
    return result;
  }

  // extract value
  const validatedValue = validateExpressionIsStringLiteral(value.value);
  result.errors.push(...validatedValue.errors);
  result.value = validatedValue.value;

  return result;
}

/**
 * Validate that an expression is a string literal
 */
function validateExpressionIsStringLiteral(expr: t.Expression): {
  errors: string[];
  value?: string;
} {
  if (t.isStringLiteral(expr)) {
    return { errors: [], value: expr.value };
  }
  if (t.isTemplateLiteral(expr) && expr.expressions.length === 0) {
    return { errors: [], value: expr.quasis[0]?.value.cooked };
  }
  return { errors: ['Expression is not a string literal'] };
}

/**
 * Validates if an expression using the declareStatic function correctly
 */
function validateDeclareStatic(
  expr: t.Expression,
  state: TransformState,
  errors: string[]
): { errors: string[] } {
  if (!expr) {
    errors.push('Expression is empty');
    return { errors };
  }

  // 1. Direct call: declareStatic(node)
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
    // Validate the function is actually the GT declareStatic function
    if (
      type !== 'generaltranslation' ||
      canonicalName !== GT_OTHER_FUNCTIONS.declareStatic
    ) {
      errors.push('Expression does not use an allowed call expression');
      return { errors };
    }
    // Validate that the call expression has exactly one argument and the argument is a call expression
    validateDeclareStaticExpression(expr, errors);
    return { errors };
  }

  // 2. String concatenation: "Hello there " + declareStatic(getName())
  if (t.isBinaryExpression(expr) && expr.operator === '+') {
    if (!t.isExpression(expr.left) || !t.isExpression(expr.right)) {
      errors.push('Operands must be expressions');
      return { errors };
    }
    validateDeclareStatic(expr.right, state, errors);
    validateDeclareStatic(expr.left, state, errors);
    return { errors };
  }

  // 3. Template literal: `Hello there ${declareStatic(getName())}`
  if (t.isTemplateLiteral(expr)) {
    if (
      !expr.expressions.some(
        (expression) =>
          t.isExpression(expression) &&
          validateDeclareStatic(expression, state, errors).errors.length === 0
      )
    ) {
      errors.push('Expression does not use an allowed call expression');
    }
    return {
      errors,
    };
  }

  // Fallthrough: expression type not supported (e.g., plain identifiers/variables)
  errors.push('Variables are not allowed');
  return { errors };
}

/**
 * Takes in a call expression to check if:
 * - it has exactly one argument
 * - the argument is a call expression
 * Example: declareStatic(getName())
 */
function validateDeclareStaticExpression(
  expr: t.CallExpression,
  errors: string[]
): {
  errors: string[];
} {
  // Validate that the function has 1 argument
  if (expr.arguments.length !== 1) {
    errors.push('DeclareStatic must have one argument');
    return { errors };
  }
  const [onlyArg] = expr.arguments;

  // Await expression: declareStatic(await ...)
  if (t.isAwaitExpression(onlyArg)) {
    // Validate that the awaited expression is a call expression
    if (!t.isCallExpression(onlyArg.argument)) {
      errors.push('DeclareStatic must have a call expression as the argument');
      return { errors };
    }
    // Valid: declareStatic(await someFunction())
    return { errors };
  }

  // Validate that the argument is a call expression
  if (!t.isCallExpression(onlyArg)) {
    errors.push('DeclareStatic must have a call expression as the argument');
    return { errors };
  }

  return { errors };
}
