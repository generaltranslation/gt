import * as t from '@babel/types';
import { USEGT_CALLBACK_OPTIONS } from '../constants/gt/constants';

/**
 * Validate useGT_callback / getGT_callback
 * - first argument must be a string literal
 * - second argument, if present, $id field + $context field must be a string literal
 */
export function validateUseGTCallback(callExpr: t.CallExpression): {
  errors: string[];
  content?: string;
  context?: string;
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
  let content: string | undefined;
  if (!t.isExpression(callExpr.arguments[0])) {
    errors.push(
      'useGT_callback / getGT_callback must have a string literal as the first argument'
    );
    return { errors };
  }

  // Get content
  const validatedContent = validateExpressionIsStringLiteral(
    callExpr.arguments[0]
  );
  errors.push(...validatedContent.errors);
  content = validatedContent.value;
  if (content === undefined) {
    errors.push(
      'useGT_callback / getGT_callback must have a string literal as the first argument'
    );
    return { errors };
  }

  // Validate second argument
  let context: string | undefined;
  let id: string | undefined;
  if (callExpr.arguments.length === 1) return { errors };
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
  }

  return { errors, content, context, id };
}

/**
 * Validate useTranslations_callback / getTranslations_callback
 * - always valid (arguments can be dynamic)
 */
export function validateUseTranslationsCallback(callExpr: t.CallExpression): {
  errors: string[];
} {
  const errors: string[] = [];
  return { errors };
}

/**
 * Validate useMessages_callback / getMessages_callback
 * - always valid
 */
export function validateUseMessagesCallback(callExpr: t.CallExpression): {
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
      `useGT_callback / getGT_callback must have a string literal for its ${name} field`
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
