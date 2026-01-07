import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import { GT_LIBRARIES, RULE_URL } from '../../utils/constants.js';
import { isMsgFunction } from '../../utils/isGTFunction.js';

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
      // msg(someVariable) (no fix)
      staticStringRequired:
        'Registration functions can only accept static strings.',
      // msg(`Hello, ${name}!`)
      variableInterpolationRequired:
        'Dynamically constructed strings are not allowed. Use ICU-style variable interpolation instead.',
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
        if (!isMsgFunction({ context, node, libs })) return;
        console.log(node);

        // Ignore if there is no first argument
        if (node.arguments.length === 0) return;

        // Disallow spread elements (no fix)
        const firstArgument = node.arguments[0];
        if (firstArgument.type === TSESTree.AST_NODE_TYPES.SpreadElement) {
          context.report({
            node: firstArgument,
            messageId: 'variableInterpolationRequired',
          });
          return;
        }

        // Check if the first argument is a static string
        // TODO: allow for supported syntax like "A" + "B"
        // TODO: add declareStatic() handling
        // TODO: add auto fix for supported syntax like "Hello " + "World" or `Hello ${name}!`
        if (!isStaticString(firstArgument)) {
          context.report({
            node: firstArgument,
            messageId: 'staticStringRequired',
          });
          return;
        }
      },
    };
  },
});
