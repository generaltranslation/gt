/**
 * Sugar variable validation for gt()/msg() options objects.
 *
 * Validates that metadata keys ($context, $id, $format, $maxChars) are static:
 * - $context: static string or derive()/declareStatic() in concatenation
 * - $id:      static string only
 * - $format:  static string only
 * - $maxChars: number literal only
 *
 * Non-sugar keys (ICU params like { name: value }) are ignored.
 */

import { TSESTree } from '@typescript-eslint/utils';
import type { RuleContext } from '@typescript-eslint/utils/ts-eslint';
import {
  CONTEXT_OPTION_NAME,
  FORMAT_OPTION_NAME,
  ICU_FORMAT,
  MAX_CHARS_OPTION_NAME,
  SUGAR_VARIABLE_NAMES,
} from '../../utils/constants.js';
import type { GTLibrary } from '../../utils/constants.js';
import { isDeriveFunction } from '../../utils/isGTFunction.js';
import {
  isStaticString,
  staticStringValue,
} from '../../utils/expression-utils.js';

/**
 * Extracts the property key name from Identifier or string Literal keys.
 * Returns null for computed keys or non-string literals.
 */
function getPropertyKeyName(
  key: TSESTree.Expression | TSESTree.PrivateIdentifier
): string | null {
  if (key.type === TSESTree.AST_NODE_TYPES.Identifier) {
    return key.name;
  }
  if (
    key.type === TSESTree.AST_NODE_TYPES.Literal &&
    typeof key.value === 'string'
  ) {
    return key.value;
  }
  return null;
}

/**
 * Accepts number literals and unary +/- on number literals (e.g. -5, +10).
 */
function isStaticNumber(node: TSESTree.Expression): boolean {
  if (
    node.type === TSESTree.AST_NODE_TYPES.Literal &&
    typeof node.value === 'number'
  ) {
    return true;
  }
  if (
    node.type === TSESTree.AST_NODE_TYPES.UnaryExpression &&
    (node.operator === '-' || node.operator === '+') &&
    node.argument.type === TSESTree.AST_NODE_TYPES.Literal &&
    typeof node.argument.value === 'number'
  ) {
    return true;
  }
  return false;
}

/**
 * $context allows static strings, derive()/declareStatic(), and concatenation of those.
 */
function isStaticOrDerive(
  expr: TSESTree.Expression,
  context: Readonly<RuleContext<string, readonly unknown[]>>,
  libs: readonly GTLibrary[]
): boolean {
  if (isStaticString(expr)) return true;
  if (
    expr.type === TSESTree.AST_NODE_TYPES.CallExpression &&
    isDeriveFunction({ context, node: expr, libs })
  ) {
    return true;
  }
  if (
    expr.type === TSESTree.AST_NODE_TYPES.BinaryExpression &&
    expr.operator === '+'
  ) {
    return (
      isStaticOrDerive(expr.left, context, libs) &&
      isStaticOrDerive(expr.right, context, libs)
    );
  }
  return false;
}

/**
 * Reads the $format value from a call's options object, or null if absent/dynamic.
 */
export function getFormatOption(
  callNode: TSESTree.CallExpression
): string | null {
  const secondArg = callNode.arguments[1];
  if (
    !secondArg ||
    secondArg.type !== TSESTree.AST_NODE_TYPES.ObjectExpression
  ) {
    return null;
  }
  for (const prop of secondArg.properties) {
    if (prop.type !== TSESTree.AST_NODE_TYPES.Property || prop.computed) {
      continue;
    }
    const keyName = getPropertyKeyName(prop.key);
    if (keyName !== FORMAT_OPTION_NAME) continue;
    const value = staticStringValue(prop.value as TSESTree.Expression);
    if (value !== null) return value;
  }
  return null;
}

/**
 * Returns true if the call uses ICU format (the default when $format is absent).
 */
export function isICUFormat(callNode: TSESTree.CallExpression): boolean {
  const format = getFormatOption(callNode);
  return format === null || format === ICU_FORMAT;
}

/**
 * Reports errors for any sugar variable that isn't static.
 */
export function validateSugarVariables(
  callNode: TSESTree.CallExpression,
  context: Readonly<RuleContext<string, readonly unknown[]>>,
  libs: readonly GTLibrary[]
): void {
  const secondArg = callNode.arguments[1];
  if (
    !secondArg ||
    secondArg.type !== TSESTree.AST_NODE_TYPES.ObjectExpression
  ) {
    return;
  }

  for (const prop of secondArg.properties) {
    // Computed keys like { ["$context"]: val } and spread elements are
    // intentionally skipped — only identifier and string-literal keys are checked.
    if (prop.type !== TSESTree.AST_NODE_TYPES.Property || prop.computed) {
      continue;
    }

    const key = getPropertyKeyName(prop.key);
    if (
      !key ||
      !SUGAR_VARIABLE_NAMES.includes(
        key as (typeof SUGAR_VARIABLE_NAMES)[number]
      )
    ) {
      continue;
    }

    const value = prop.value as TSESTree.Expression;

    if (key === MAX_CHARS_OPTION_NAME) {
      if (!isStaticNumber(value)) {
        context.report({
          node: value,
          messageId: 'sugarVariableMustBeStatic',
        });
      }
      continue;
    }

    if (key === CONTEXT_OPTION_NAME) {
      if (!isStaticOrDerive(value, context, libs)) {
        context.report({
          node: value,
          messageId: 'sugarVariableMustBeStatic',
        });
      }
      continue;
    }

    /* $id, $format — must be static string */
    if (!isStaticString(value)) {
      context.report({
        node: value,
        messageId: 'sugarVariableMustBeStatic',
      });
    }
  }
}
