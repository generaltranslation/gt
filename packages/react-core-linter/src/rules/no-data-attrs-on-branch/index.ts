import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import { GT_LIBRARIES, RULE_URL } from '../../utils/constants.js';
import { isBranchComponent } from '../../utils/isGTFunction.js';

const createRule = ESLintUtils.RuleCreator((name) => `${RULE_URL}${name}`);

export const noDataAttrsOnBranch = createRule({
  name: 'no-data-attrs-on-branch',
  meta: {
    type: 'problem',
    docs: {
      description:
        'The Branch component ignores any attributes prefixed with "data-".',
    },
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
      noDataAttrsOnBranch:
        "The Branch component ignores any attributes prefixed with 'data-'. Remove data-* attributes from Branch.",
    },
  },
  defaultOptions: [{ libs: GT_LIBRARIES }],
  create(context, [options]) {
    const { libs = GT_LIBRARIES } = options;

    return {
      JSXAttribute(node: TSESTree.JSXAttribute) {
        // Check if the attribute name starts with "data-"
        if (
          node.name.type !== TSESTree.AST_NODE_TYPES.JSXIdentifier ||
          !node.name.name.startsWith('data-')
        ) {
          return;
        }

        // Walk up to the parent JSXOpeningElement
        const parent = node.parent;
        if (
          !parent ||
          parent.type !== TSESTree.AST_NODE_TYPES.JSXOpeningElement
        ) {
          return;
        }

        // Check if the parent is a Branch component
        if (isBranchComponent({ context, node: parent, libs })) {
          context.report({
            node,
            messageId: 'noDataAttrsOnBranch',
          });
        }
      },
    };
  },
});
