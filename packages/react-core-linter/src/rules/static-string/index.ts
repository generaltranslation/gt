import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import { GT_LIBRARIES, RULE_URL } from '../../utils/constants.js';
import {
  isDeriveFunction,
  isGTCallbackFunction,
  isMsgFunction,
} from '../../utils/isGTFunction.js';

/**
 * Static string rule for translation components
 */
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
      // generic error message (no fix)
      staticStringRequired:
        'Registration functions (gt, msg) can only accept static strings. For example: msg("This is a static string!").',
      // msg(`Hello, ${name}!`) TODO: autofix
      variableInterpolationRequired:
        'Registration functions (gt, msg) can only accept static strings. Use ICU-style variable interpolation instead (e.g. gt("Hello {name}!"), { name: value }).',
      // TODO: missing a variable in interpolation (gt() only) (no fix)
      missingVariableInInterpolation:
        'Missing a variable in interpolation. Any variable supplied to the ICU-string, must be provided as a key in the options object.',
      // TODO: any sugar variables must be static (no fix)
      sugarVariableMustBeStatic:
        'Sugar variables must be static strings. For example: gt("Hello!", { $context: "A greeting" }).',
    },
  },
  defaultOptions: [{ libs: GT_LIBRARIES }],
  create(context, [options]) {
    const { libs = GT_LIBRARIES } = options;

    return {
      /**
       * Handle function calls
       */
      CallExpression(node: TSESTree.CallExpression) {
        const isMsgCall = isMsgFunction({ context, node, libs });
        if (!isMsgCall && !isGTCallbackFunction({ context, node, libs })) {
          return;
        }

        // Ignore if there is no first argument
        if (node.arguments.length === 0) return;

        // Disallow spread elements (no fix)
        const firstArgument = node.arguments[0];
        if (firstArgument.type === TSESTree.AST_NODE_TYPES.SpreadElement) {
          return context.report({
            node: firstArgument,
            messageId: 'variableInterpolationRequired',
          });
        }

        // Validate params — arrays only allowed for msg()
        validateGTInvocation(firstArgument, isMsgCall);

        /**
         * Helper function to validate gt()'s params
         * TODO: when enable array support in gt function remove allowArrays parameter as it will always be true
         */
        function validateGTInvocation(
          expression: TSESTree.Expression,
          allowArrays: boolean = false
        ) {
          // Static string is okay
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
                validateGTInvocation(element, false); // no nested arrays
              } else if (
                element?.type === TSESTree.AST_NODE_TYPES.SpreadElement
              ) {
                return context.report({
                  node: element,
                  messageId: 'staticStringRequired',
                });
              }
            }
            return;
          }

          // declareStatic() is okay
          if (
            expression.type === TSESTree.AST_NODE_TYPES.CallExpression &&
            isDeriveFunction({ context, node: expression, libs })
          ) {
            return;
          }

          // Validate binary expressions: "A" + declareStatic(??) + `C`
          if (
            expression.type === TSESTree.AST_NODE_TYPES.BinaryExpression &&
            expression.operator === '+'
          ) {
            validateGTInvocation(expression.left);
            validateGTInvocation(expression.right);
            return;
          }

          // Interpolation: `Hello ${name}!`
          if (expression.type === TSESTree.AST_NODE_TYPES.TemplateLiteral) {
            // TODO: keep track of nodes to interpolate
            return context.report({
              node: expression,
              messageId: 'variableInterpolationRequired',
            });
          }

          // Generic error message
          return context.report({
            node: expression,
            messageId: 'staticStringRequired',
          });
        }
      },
    };
  },
});
