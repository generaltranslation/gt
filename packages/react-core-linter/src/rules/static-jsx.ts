import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import {
  ALLOWED_BRANCH_ATTRIBUTE_JSX_EXPRESSIONS,
  ALLOWED_JSX_EXPRESSIONS,
  GT_LIBRARIES,
  RULE_URL,
} from '../utils/constants.js';
import {
  isBranchComponent,
  isBranchingComponent,
  isTComponent,
  isVariableComponent,
} from '../utils/isGTFunction.js';
import { isContentBranch } from '../utils/branching-utils.js';

/**
 * Static JSX applies to children of the <T> component
 */
const createRule = ESLintUtils.RuleCreator((name) => `${RULE_URL}${name}`);

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
    const scopeStack: (
      | 'no-T' // No check
      | 'T' // Check static
      | 'Branch' // Check attrs
      | 'Plural' // Check attrs
      | 'Branching-Attribute' // Handle JsxExpressionContainers different
    )[] = ['no-T'];
    function inTranslatableContent(): boolean {
      const scope = scopeStack[scopeStack.length - 1];
      return scope === 'T';
    }
    function inBranchingComponent(): boolean {
      const scope = scopeStack[scopeStack.length - 1];
      return scope === 'Branch' || scope === 'Plural';
    }
    function inBranchingAttribute(): boolean {
      return scopeStack[scopeStack.length - 1] === 'Branching-Attribute';
    }
    function inBranchT(): boolean {
      return (
        scopeStack.length >= 2 &&
        scopeStack[scopeStack.length - 1] === 'T' &&
        scopeStack[scopeStack.length - 2] === 'Branching-Attribute'
      );
    }
    function getScope() {
      return scopeStack[scopeStack.length - 1];
    }
    return {
      /**
       * Flag dynamic content
       * When we are inside of a branching attribute, mark it as Branch-T
       */
      JSXExpressionContainer(node: TSESTree.JSXExpressionContainer) {
        if (!node.expression) return;
        // Handle T component and branching attribute cases
        if (inTranslatableContent()) {
          if (!ALLOWED_JSX_EXPRESSIONS.includes(node.expression.type)) {
            return context.report({
              node,
              messageId: 'dynamicContent',
              // TODO: fix by adding <Var>
            });
          }
        } else if (inBranchingAttribute()) {
          // Translate as normal
          scopeStack.push('T');
          // Check errors
          if (
            !ALLOWED_BRANCH_ATTRIBUTE_JSX_EXPRESSIONS.includes(
              node.expression.type
            )
          ) {
            return context.report({
              node,
              messageId: 'dynamicContent',
              // TODO: fix by adding <Var>
            });
          }
        }
      },
      'JSXExpressionContainer:exit'(node) {
        if (!node.expression || !inBranchT()) return;
        scopeStack.pop();
      },
      /**
       * Flag the entrance/exit of a T component
       */
      JSXElement(node) {
        // Filter out non-T components
        if (isTComponent({ context, node: node.openingElement, libs }))
          scopeStack.push('T');
        if (isVariableComponent({ context, node: node.openingElement, libs }))
          scopeStack.push('no-T');
      },
      'JSXElement:exit'(node) {
        if (
          isTComponent({ context, node: node.openingElement, libs }) ||
          isVariableComponent({ context, node: node.openingElement, libs })
        ) {
          scopeStack.pop();
        }
      },
      /**
       * JSXOpeningElement, JSXOpeningElement:exit handle ignoring arguments
       */
      JSXOpeningElement(node) {
        if (
          inTranslatableContent() &&
          isBranchingComponent({ context, node, libs })
        ) {
          if (isBranchComponent({ context, node, libs })) {
            scopeStack.push('Branch');
          } else {
            scopeStack.push('Plural');
          }
        } else {
          scopeStack.push('no-T');
        }
      },
      'JSXOpeningElement:exit'() {
        scopeStack.pop();
      },
      /**
       * JSXAttribute for branch/plural children
       * TODO: disallow spreads, (unless we know that they somehow only contain "branch" or "n" properties)
       */
      JSXAttribute(node: TSESTree.JSXAttribute) {
        // Filter out non-branching attributes, or non-expression containers
        if (
          !inBranchingComponent() ||
          node.value?.type !== TSESTree.AST_NODE_TYPES.JSXExpressionContainer
        ) {
          return;
        }

        // Filter out branching properties, or non-options (null, literals, etc.)
        if (!isContentBranch({ tScope: getScope(), node })) return;
        scopeStack.push('Branching-Attribute');
      },
      'JSXAttribute:exit'(node: TSESTree.JSXAttribute) {
        if (
          !inBranchingAttribute() ||
          node.value?.type !== TSESTree.AST_NODE_TYPES.JSXExpressionContainer
        ) {
          return;
        }

        // Filter out branching properties, or non-options (null, literals, etc.)
        if (!isContentBranch({ tScope: getScope(), node })) return;
        scopeStack.pop();
      },
    };
  },
});
