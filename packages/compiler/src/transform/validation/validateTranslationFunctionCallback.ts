import * as t from '@babel/types';
import {
  GT_OTHER_FUNCTIONS,
  USEGT_CALLBACK_OPTIONS,
} from '../../utils/constants/gt/constants';
import { TransformState } from '../../state/types';
import { getCalleeNameFromExpression } from '../../utils/parsing/getCalleeNameFromExpression';
import { resolveStaticExpression } from '../../utils/string-expressions/resolveStaticExpression';
import { getTrackedVariable } from '../getTrackedVariable';
import { NodePath } from '@babel/traverse';

/**
 * Validate useGT_callback / getGT_callback
 * - first argument must be a statically resolvable string expression
 *   (string literal, template literal, binary '+' concatenation, or derive() call)
 * - second argument, if present, $id field + $context field must be a string literal
 */
export function validateUseGTCallback(
  callExprPath: NodePath<t.CallExpression>,
  state: TransformState
): {
  errors: string[];
  content?: string;
  context?: string;
  hash?: string;
  id?: string;
  maxChars?: number;
  format?: string;
  hasDeriveContext?: boolean;
} {
  const callExpr = callExprPath.node;
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
      'useGT_callback / getGT_callback must use a string literal or derive() call as the first argument. Variable content is not allowed.'
    );
    return { errors };
  }

  // Try to resolve the expression to a static string (handles concat, nested templates, etc.)
  const resolvedStaticExpression = resolveStaticExpression(
    callExprPath.get('arguments')[0] as NodePath<t.Expression>
  );
  // TODO: until we implement derivation, we will only need to check the first value
  const content = resolvedStaticExpression.values?.[0];

  if (content === undefined && !state.settings.autoderive.strings) {
    // Not a static expression — check if it contains a derive() function invocation
    validateDerive(callExpr.arguments[0], state, errors);
    if (errors.length > 0) {
      errors.push(...resolvedStaticExpression.errors);
      errors.push(
        'useGT_callback / getGT_callback must use a string literal or derive() call as the first argument. Variable content is not allowed.'
      );
      return { errors };
    }
  }

  // TODO: hasDeriveContext should be refactored to enforce no hash generated HERE in this function
  // instead of passing that information outside of this function.
  // We skip hash gen with autoderive, derive in content, and derive in $context. This flag is being
  // reused for all 3 cases.
  const contentHasAutoderive =
    state.settings.autoderive.strings && content === undefined;

  // Validate second argument
  let context: string | undefined;
  let id: string | undefined;
  let hash: string | undefined;
  let maxChars: number | undefined;
  let format: string | undefined;
  let hasDeriveContext: boolean | undefined;
  if (callExpr.arguments.length === 1) {
    return {
      errors,
      content,
      hasDeriveContext: contentHasAutoderive || undefined,
    };
  }
  if (t.isObjectExpression(callExpr.arguments[1])) {
    const objExprPath = callExprPath.get(
      'arguments'
    )[1] as NodePath<t.ObjectExpression>;
    const contextProperty = validatePropertyFromObjectExpression(
      objExprPath,
      USEGT_CALLBACK_OPTIONS.$context,
      'string-or-derive',
      state
    );
    errors.push(...contextProperty.errors);
    context = contextProperty.value as string | undefined;
    hasDeriveContext =
      contentHasAutoderive || contextProperty.hasDeriveExpression;
    const idProperty = validatePropertyFromObjectExpression(
      objExprPath,
      USEGT_CALLBACK_OPTIONS.$id,
      'string'
    );
    errors.push(...idProperty.errors);
    id = idProperty.value;
    const maxCharsProperty = validatePropertyFromObjectExpression(
      objExprPath,
      USEGT_CALLBACK_OPTIONS.$maxChars,
      'number'
    );
    errors.push(...maxCharsProperty.errors);
    maxChars = maxCharsProperty.value;
    const hashProperty = validatePropertyFromObjectExpression(
      objExprPath,
      USEGT_CALLBACK_OPTIONS.$_hash,
      'string'
    );
    errors.push(...hashProperty.errors);
    hash = hashProperty.value;
    const formatProperty = validatePropertyFromObjectExpression(
      objExprPath,
      USEGT_CALLBACK_OPTIONS.$format,
      'string'
    );
    errors.push(...formatProperty.errors);
    format = formatProperty.value;
  }

  return {
    errors,
    content,
    context,
    id,
    hash,
    maxChars,
    format,
    hasDeriveContext,
  };
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
  objExprPath: NodePath<t.ObjectExpression>,
  name: string,
  type: 'string'
): { errors: string[]; value?: string };
function validatePropertyFromObjectExpression(
  objExprPath: NodePath<t.ObjectExpression>,
  name: string,
  type: 'number'
): { errors: string[]; value?: number };
function validatePropertyFromObjectExpression(
  objExprPath: NodePath<t.ObjectExpression>,
  name: string,
  type: 'string-or-derive',
  state: TransformState
): { errors: string[]; value?: string; hasDeriveExpression?: boolean };
function validatePropertyFromObjectExpression(
  objExprPath: NodePath<t.ObjectExpression>,
  name: string,
  type: 'string' | 'number' | 'string-or-derive',
  state?: TransformState
): {
  errors: string[];
  value?: string | number;
  hasDeriveExpression?: boolean;
} {
  const result: {
    errors: string[];
    value?: string | number;
    hasDeriveExpression?: boolean;
  } = { errors: [] };
  let valuePath: NodePath<t.ObjectProperty> | undefined;
  for (const propertyPath of objExprPath.get('properties')) {
    if (!propertyPath.isObjectProperty()) {
      continue;
    }
    const property = propertyPath.node;
    if (t.isIdentifier(property.key) && property.key.name === name) {
      valuePath = propertyPath;
      break;
    }
    if (t.isStringLiteral(property.key) && property.key.value === name) {
      valuePath = propertyPath;
      break;
    }
  }

  // return result if no value found
  if (!valuePath) {
    return result;
  }

  const value = valuePath.node;

  // validate value
  if (!t.isExpression(value.value)) {
    result.errors.push(
      `useGT_callback / getGT_callback must use a string literal for its ${name} field. Variable content is not allowed.`
    );
    return result;
  }

  // extract value
  if (type === 'string-or-derive') {
    const resolved = resolveStaticExpression(
      valuePath.get('value') as NodePath<t.Expression>
    );
    // TODO: until we implement derivation, we will only need to check the first value
    if (resolved.values?.[0] !== undefined) {
      result.value = resolved.values[0];
    } else if (state) {
      // Static resolution failed — check if it's a valid derive() expression
      const deriveErrors: string[] = [];
      validateDerive(value.value, state, deriveErrors);
      if (deriveErrors.length === 0) {
        result.hasDeriveExpression = true;
      } else {
        result.errors.push(...resolved.errors, ...deriveErrors);
      }
    } else {
      result.errors.push(...resolved.errors);
    }
  } else {
    const validatedValue =
      type === 'string'
        ? validateExpressionIsStringLiteral(value.value)
        : validateExpressionIsNumericLiteral(value.value);
    result.errors.push(...validatedValue.errors);
    result.value = validatedValue.value;
  }

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
      (canonicalName !== GT_OTHER_FUNCTIONS.declareStatic &&
        canonicalName !== GT_OTHER_FUNCTIONS.derive)
    ) {
      errors.push('Expression does not use an allowed call expression');
      return { errors };
    }
    // Validate that the call expression has exactly one argument and the argument is a call expression
    validateDeclareStaticExpression(expr, errors);
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
function validateDeclareStaticExpression(
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

/**
 * Validate that an expression is a number literal
 */
function validateExpressionIsNumericLiteral(expr: t.Expression): {
  errors: string[];
  value?: number;
} {
  let candidateValue: number | undefined;
  if (t.isNumericLiteral(expr)) {
    candidateValue = expr.value;
  } else if (t.isUnaryExpression(expr) && t.isNumericLiteral(expr.argument)) {
    // Note: taking the absolute value of the number literal
    candidateValue = expr.argument.value;
  }

  // validate is integer
  if (candidateValue !== undefined && !Number.isInteger(candidateValue)) {
    return { errors: ['Expression is not an integer'] };
  }

  // no value found
  if (candidateValue === undefined) {
    return { errors: ['Expression is not a number literal'] };
  }

  return { errors: [], value: candidateValue };
}
