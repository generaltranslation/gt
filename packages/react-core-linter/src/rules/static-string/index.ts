/**
 * Static string rule for msg().
 *
 * The CLI extracts msg('Save') as written, so its argument must be a single
 * string literal. A message with values is a tagged msg`...` template, and
 * msg({ context })`...` configures one.
 */

import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import { GT_LIBRARIES, RULE_URL } from '../../utils/constants.js';
import { isStaticString } from '../../utils/expression-utils.js';
import { isMsgFunction } from '../../utils/isGTFunction.js';

const createRule = ESLintUtils.RuleCreator((name) => `${RULE_URL}${name}`);

export const staticString = createRule({
  name: 'static-string',
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce a static string argument in msg() calls.',
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
            description: 'List of library modules to check for msg()',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      staticStringRequired:
        "msg() takes a single string literal, so the message can be extracted. Pass a string literal, as in msg('Save'), or write the message as a tagged msg`...` template.",
    },
  },
  defaultOptions: [{ libs: GT_LIBRARIES }],
  create(context, [options]) {
    const { libs = GT_LIBRARIES } = options;

    return {
      CallExpression(node) {
        if (!isMsgFunction({ context, node, libs })) return;
        // msg(options)`...` configures a tag.
        if (
          node.parent.type === AST_NODE_TYPES.TaggedTemplateExpression &&
          node.parent.tag === node
        ) {
          return;
        }
        const [argument] = node.arguments;
        if (node.arguments.length === 1) {
          // const button = msg({ context: 'button' })
          if (argument.type === AST_NODE_TYPES.ObjectExpression) return;
          if (
            argument.type !== AST_NODE_TYPES.SpreadElement &&
            isStaticString(argument)
          ) {
            return;
          }
        }
        context.report({
          node: argument ?? node,
          messageId: 'staticStringRequired',
        });
      },
    };
  },
});
