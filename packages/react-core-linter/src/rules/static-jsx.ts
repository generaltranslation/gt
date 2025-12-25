import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import { GT_LIBRARIES, GTLibrary } from '../utils/constants.js';
import { isTComponent } from '../utils/isGTComponent.js';

/**
 * Static JSX applies to children of the <T> component
 */
const createRule = ESLintUtils.RuleCreator(
  // TODO: Add URL to the rule
  (name) => `https://example.com/rule/${name}`
);

export const staticJsx = createRule({
  name: 'static-jsx',
  meta: {
    type: 'problem',
    docs: {
      description: 'The <T> component must only have static children.',
    },
    fixable: undefined,
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
      dynamicContent:
        'All dynamic content must be wrapped in a variable component (<Var>, <DateTime>, <Num>, or <Currency>).',
    },
  },
  defaultOptions: [{ libs: [] as GTLibrary[] }],
  create(context, [options]) {
    const { libs = GT_LIBRARIES } = options;

    return {
      JSXOpeningElement(node: TSESTree.JSXOpeningElement) {
        // Filter out non-T components
        if (!isTComponent({ context, node, libs })) return;

        // DEBUG: for now just have an error for the T component
        context.report({
          node: node.parent,
          messageId: 'dynamicContent',
        });
      },
    };
  },
});
