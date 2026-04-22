/**
 * Static string rule for translation functions (gt, msg).
 *
 * Enforces that the content string (first argument) is static, with auto-fix
 * to convert dynamic expressions into ICU-formatted strings when possible.
 * Also validates that sugar variables ($context, $id, $format, $maxChars)
 * in the options object (second argument) are static.
 */

import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import type { RuleFixer } from '@typescript-eslint/utils/ts-eslint';
import { GT_LIBRARIES, RULE_URL } from '../../utils/constants.js';
import {
  isDeriveFunction,
  isGTCallbackFunction,
  isMsgFunction,
} from '../../utils/isGTFunction.js';
import {
  flattenConcat,
  flattenTemplateLiteral,
  isFixable,
  hasDerive,
  generateICUReplacement,
  generateTemplateLiteralReplacement,
} from './icu-fix.js';
import type { FlatPart } from './icu-fix.js';
import { isICUFormat, validateSugarVariables } from './sugar-fix.js';

const createRule = ESLintUtils.RuleCreator((name) => `${RULE_URL}${name}`);

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
    },
  },
  defaultOptions: [{ libs: GT_LIBRARIES }],
  create(context, [options]) {
    const { libs = GT_LIBRARIES } = options;

    // Validates the first argument (content string) of a gt()/msg() call.
    // Attempts ICU auto-fix for fixable dynamic expressions.
    function validateContentString(
      expression: TSESTree.Expression,
      allowArrays: boolean,
      callNode: TSESTree.CallExpression
    ) {
      if (isStaticString(expression)) return;

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
        fix(fixer: RuleFixer) {
          const containsDerive = hasDerive(parts);
          const {
            options: icuOptions,
            templateString,
            icuString,
          } = containsDerive
            ? generateTemplateLiteralReplacement(parts, context.sourceCode)
            : {
                ...generateICUReplacement(parts, context.sourceCode),
                templateString: null,
              };

          const replacementStr = containsDerive
            ? templateString!
            : `"${icuString}"`;

          const optionsStr = icuOptions
            .map((o) => `${o.key}: ${o.value}`)
            .join(', ');

          const secondArg = callNode.arguments[1];

          // Merge ICU vars into existing options object
          if (
            secondArg &&
            secondArg.type === TSESTree.AST_NODE_TYPES.ObjectExpression
          ) {
            const existingProps = secondArg.properties;
            const fixes: ReturnType<RuleFixer['replaceText']>[] = [];
            fixes.push(fixer.replaceText(expression, replacementStr));
            if (existingProps.length > 0) {
              fixes.push(
                fixer.insertTextAfter(
                  existingProps[existingProps.length - 1],
                  `, ${optionsStr}`
                )
              );
            }
            return fixes;
          }

          // No existing second argument — create one
          return fixer.replaceText(
            expression,
            `${replacementStr}, { ${optionsStr} }`
          );
        },
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
