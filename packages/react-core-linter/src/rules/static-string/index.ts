/**
 * Static string rule for translation functions (gt, msg).
 *
 * Enforces that the content string (first argument) is static, with auto-fix
 * to convert dynamic expressions into ICU-formatted strings when possible.
 * Also validates that sugar variables ($context, $id, $format, $maxChars)
 * in the options object (second argument) are static.
 */

import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import { GT_LIBRARIES, RULE_URL } from '../../utils/constants.js';
import {
  isStaticString,
  staticStringValue,
} from '../../utils/expression-utils.js';
import {
  isDeriveFunction,
  isGTCallbackFunction,
  isMsgFunction,
} from '../../utils/isGTFunction.js';
import {
  buildICUFix,
  flattenConcat,
  flattenTemplateLiteral,
  hasDerive,
  isFixable,
  mergeStaticParts,
} from './icu-fix.js';
import type { FlatPart } from './icu-fix.js';
import { validateICU } from './icu-validate.js';
import { isICUFormat, validateSugarVariables } from './sugar-fix.js';

const createRule = ESLintUtils.RuleCreator((name) => `${RULE_URL}${name}`);

export const staticString = createRule({
  name: 'static-string',
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce static string usage in translation components.',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          libs: {
            type: 'array',
            items: {
              type: 'string',
            },
            description:
              'List of library modules to check for translation components',
          },
        },
        additionalProperties: false,
      },
    ],
    hasSuggestions: false,
    messages: {
      staticStringRequired:
        'Registration functions (gt, msg) can only accept static strings. For example: msg("This is a static string!").',
      variableInterpolationRequired:
        'Registration functions (gt, msg) can only accept static strings. Use ICU-style variable interpolation instead (e.g. gt("Hello {name}!"), { name: value }).',
      missingVariableInInterpolation:
        'Missing a variable in interpolation. Any variable supplied to the ICU-string, must be provided as a key in the options object.',
      sugarVariableMustBeStatic:
        'Sugar variables must be static strings. For example: gt("Hello!", { $context: "A greeting" }).',
      invalidICUFormat: 'Invalid ICU message format: {{ error }}',
    },
  },
  defaultOptions: [{ libs: GT_LIBRARIES }],
  create(context, [options]) {
    const { libs = GT_LIBRARIES } = options;

    // Validates a static string as ICU if the format is ICU.
    function checkICUValidity(
      str: string,
      node: TSESTree.Expression,
      callNode: TSESTree.CallExpression
    ) {
      if (!isICUFormat(callNode)) return;
      const error = validateICU(str);
      if (error) {
        context.report({
          node,
          messageId: 'invalidICUFormat',
          data: { error },
        });
      }
    }

    // Validates the first argument (content string) of a gt()/msg() call.
    // Attempts ICU auto-fix for fixable dynamic expressions.
    function validateContentString(
      expression: TSESTree.Expression,
      allowArrays: boolean,
      callNode: TSESTree.CallExpression
    ) {
      // Single static string — validate ICU format
      if (isStaticString(expression)) {
        const str = staticStringValue(expression);
        if (str !== null) checkICUValidity(str, expression, callNode);
        return;
      }

      // Array of static strings — only for msg() currently
      if (
        allowArrays &&
        expression.type === TSESTree.AST_NODE_TYPES.ArrayExpression
      ) {
        for (const element of expression.elements) {
          if (
            element &&
            element.type !== TSESTree.AST_NODE_TYPES.SpreadElement
          ) {
            validateContentString(element, false, callNode);
          } else if (element?.type === TSESTree.AST_NODE_TYPES.SpreadElement) {
            return context.report({
              node: element,
              messageId: 'staticStringRequired',
            });
          }
        }
        return;
      }

      // Flatten the expression into typed parts for analysis
      let parts: FlatPart[];

      if (
        expression.type === TSESTree.AST_NODE_TYPES.TemplateLiteral &&
        expression.expressions.length > 0
      ) {
        parts = flattenTemplateLiteral(expression, {
          context,
          libs,
          sourceCode: context.sourceCode,
        });
      } else if (
        expression.type === TSESTree.AST_NODE_TYPES.BinaryExpression &&
        expression.operator === '+'
      ) {
        parts = flattenConcat(expression, {
          context,
          libs,
          sourceCode: context.sourceCode,
        });

        // Check if it's all static (no dynamic, no derive) — validate ICU
        const fullStatic = mergeStaticParts(parts);
        if (fullStatic !== null) {
          checkICUValidity(fullStatic, expression, callNode);
          return;
        }
      } else {
        // Standalone derive() is valid
        if (
          expression.type === TSESTree.AST_NODE_TYPES.CallExpression &&
          isDeriveFunction({ context, node: expression, libs })
        ) {
          return;
        }
        return context.report({
          node: expression,
          messageId: 'staticStringRequired',
        });
      }

      if (!isFixable(parts)) {
        // All parts are static/derive — validate merged string as ICU
        if (!hasDerive(parts)) {
          const merged = mergeStaticParts(parts);
          if (merged) checkICUValidity(merged, expression, callNode);
        }
        return;
      }

      // Non-ICU formats ($format: "STRING" etc.) — report error, no auto-fix
      if (!isICUFormat(callNode)) {
        return context.report({
          node: expression,
          messageId: 'staticStringRequired',
        });
      }

      // Fixable: report with ICU auto-fix
      context.report({
        node: expression,
        messageId: 'variableInterpolationRequired',
        fix: buildICUFix(expression, callNode, parts, context.sourceCode),
      });
    }

    return {
      CallExpression(node: TSESTree.CallExpression) {
        const isMsgCall = isMsgFunction({ context, node, libs });
        if (!isMsgCall && !isGTCallbackFunction({ context, node, libs })) {
          return;
        }

        if (node.arguments.length === 0) return;

        const firstArgument = node.arguments[0];
        if (firstArgument.type === TSESTree.AST_NODE_TYPES.SpreadElement) {
          return context.report({
            node: firstArgument,
            messageId: 'variableInterpolationRequired',
          });
        }

        validateContentString(firstArgument, isMsgCall, node);
        validateSugarVariables(node, context, libs);
      },
    };
  },
});
