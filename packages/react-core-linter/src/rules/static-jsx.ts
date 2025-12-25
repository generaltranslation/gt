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
  defaultOptions: [{ libs: GT_LIBRARIES }],
  create(context, [options]) {
    const { libs = GT_LIBRARIES } = options;

    // Track the T component stack
    const tComponentStack: ('T' | 'no-T')[] = ['no-T'];
    return {
      /**
       * Flag dynamic content
       */
      JSXExpressionContainer(node: TSESTree.JSXExpressionContainer) {
        // Skip if we're not in a T component
        console.log('JSXExpressionContainer', tComponentStack);
        if (tComponentStack[tComponentStack.length - 1] !== 'T') return;
        context.report({
          node,
          messageId: 'dynamicContent',
        });
      },
      /**
       * Flag the entrance/exit of a T component
       */
      JSXElement(node) {
        // Filter out non-T components
        if (!isTComponent({ context, node: node.openingElement, libs })) return;
        tComponentStack.push('T');
      },
      'JSXElement:exit'(node) {
        if (!isTComponent({ context, node: node.openingElement, libs })) return;
        tComponentStack.pop();
      },
      /**
       * JSXOpeningElement, JSXOpeningElement:exit handle ignoring arguments
       */
      JSXOpeningElement() {
        tComponentStack.push('no-T');
      },
      'JSXOpeningElement:exit'() {
        tComponentStack.pop();
      },
    };
  },
});
