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

function isStaticString(node: TSESTree.Expression): boolean {
  switch (node.type) {
    case TSESTree.AST_NODE_TYPES.Literal:
      return typeof node.value === 'string';
    case TSESTree.AST_NODE_TYPES.TemplateLiteral:
      return node.expressions.length === 0;
    default:
      return false;
  }
}

function isStaticNumber(node: TSESTree.Expression): boolean {
  return (
    node.type === TSESTree.AST_NODE_TYPES.Literal &&
    typeof node.value === 'number'
  );
}

// $context allows static strings, derive()/declareStatic(), and concatenation of those.
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

// Reads the $format value from a call's options object, or null if absent/dynamic.
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
    if (
      prop.type === TSESTree.AST_NODE_TYPES.Property &&
      prop.key.type === TSESTree.AST_NODE_TYPES.Identifier &&
      prop.key.name === FORMAT_OPTION_NAME &&
      prop.value.type === TSESTree.AST_NODE_TYPES.Literal &&
      typeof prop.value.value === 'string'
    ) {
      return prop.value.value;
    }
  }
  return null;
}

// Returns true if the call uses ICU format (the default when $format is absent).
export function isICUFormat(callNode: TSESTree.CallExpression): boolean {
  const format = getFormatOption(callNode);
  return format === null || format === ICU_FORMAT;
}

// Reports errors for any sugar variable that isn't static.
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
    if (
      prop.type !== TSESTree.AST_NODE_TYPES.Property ||
      prop.key.type !== TSESTree.AST_NODE_TYPES.Identifier
    ) {
      continue;
    }

    const key = prop.key.name;
    if (
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

    // $id, $format — must be static string
    if (!isStaticString(value)) {
      context.report({
        node: value,
        messageId: 'sugarVariableMustBeStatic',
      });
    }
  }
}
