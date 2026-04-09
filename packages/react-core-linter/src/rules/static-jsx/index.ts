import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import type { RuleFixer } from '@typescript-eslint/utils/ts-eslint';
import {
  ALLOWED_BRANCH_ATTRIBUTE_JSX_EXPRESSIONS,
  ALLOWED_JSX_EXPRESSIONS,
  GT_LIBRARIES,
  RULE_URL,
  VAR_COMPONENT_NAME,
} from '../../utils/constants.js';
import {
  isBranchComponent,
  isBranchingComponent,
  isDeriveComponent,
  isTComponent,
  isVariableComponent,
} from '../../utils/isGTFunction.js';
import { isContentBranch } from '../../utils/branching-utils.js';
import { ScopeStack } from './ScopeStack.js';

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
      dynamicContent:
        'All dynamic content must be wrapped in a variable component (<Var>, <DateTime>, <Num>, or <Currency>).',
    },
  },
  defaultOptions: [{ libs: GT_LIBRARIES }],
  create(context, [options]) {
    const { libs = GT_LIBRARIES } = options;

    /**
     * Creates a fixer that wraps a JSX expression container in a <Var> component
     * and adds the Var import to the existing GT import declaration if needed.
     */
    function createVarWrapperFix(
      fixer: RuleFixer,
      node: TSESTree.JSXExpressionContainer
    ) {
      const fixes: ReturnType<RuleFixer['replaceText']>[] = [];

      // Find all GT import declarations
      const gtImportDecls = context.sourceCode.ast.body.filter(
        (stmt): stmt is TSESTree.ImportDeclaration =>
          stmt.type === TSESTree.AST_NODE_TYPES.ImportDeclaration &&
          libs.includes(stmt.source.value as string)
      );

      // Check across all GT imports if Var is already imported
      let tagName = VAR_COMPONENT_NAME;
      let varSpecifier: TSESTree.ImportSpecifier | undefined;
      for (const decl of gtImportDecls) {
        varSpecifier = decl.specifiers.find(
          (spec): spec is TSESTree.ImportSpecifier =>
            spec.type === TSESTree.AST_NODE_TYPES.ImportSpecifier &&
            spec.imported.type === TSESTree.AST_NODE_TYPES.Identifier &&
            spec.imported.name === VAR_COMPONENT_NAME
        );
        if (varSpecifier) break;
      }

      if (varSpecifier) {
        // Var is already imported — use its local name (handles aliases)
        tagName = varSpecifier.local.name;
      } else if (gtImportDecls.length > 0) {
        // Var is not imported — add it to the first GT import
        const targetDecl = gtImportDecls[0];
        const namedSpecifiers = targetDecl.specifiers.filter(
          (s): s is TSESTree.ImportSpecifier =>
            s.type === TSESTree.AST_NODE_TYPES.ImportSpecifier
        );
        if (namedSpecifiers.length > 0) {
          const lastSpecifier = namedSpecifiers[namedSpecifiers.length - 1];
          fixes.push(
            fixer.insertTextAfter(lastSpecifier, `, ${VAR_COMPONENT_NAME}`)
          );
        }
      }

      // Wrap the expression in <Var> (or its alias)
      const sourceCode = context.sourceCode.getText(node);
      const fixedCode = `<${tagName}>${sourceCode}</${tagName}>`;
      fixes.push(fixer.replaceText(node, fixedCode));

      return fixes;
    }

    // Track the T component stack
    const scopeStack = new ScopeStack();
    return {
      /**
       * Flag dynamic content
       * When we are inside of a branching attribute, mark it as Branch-T
       */
      JSXExpressionContainer(node: TSESTree.JSXExpressionContainer) {
        if (!node.expression) return;
        // Handle T component and branching attribute cases
        if (scopeStack.inTranslatableContent()) {
          if (!ALLOWED_JSX_EXPRESSIONS.includes(node.expression.type)) {
            return context.report({
              node,
              messageId: 'dynamicContent',
              fix(fixer) {
                return createVarWrapperFix(fixer, node);
              },
            });
          }
        } else if (scopeStack.inBranchingAttribute()) {
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
              fix(fixer) {
                return createVarWrapperFix(fixer, node);
              },
            });
          }
        }
      },
      'JSXExpressionContainer:exit'(node) {
        if (!node.expression || !scopeStack.inBranchT()) return;
        scopeStack.pop();
      },
      /**
       * Flag the entrance/exit of a T component
       */
      JSXElement(node) {
        // Filter out non-T components
        if (isTComponent({ context, node: node.openingElement, libs }))
          scopeStack.push('T');
        else if (
          isVariableComponent({ context, node: node.openingElement, libs })
        )
          scopeStack.push('no-T');
        else if (
          isDeriveComponent({ context, node: node.openingElement, libs })
        )
          scopeStack.push('no-T');
      },
      'JSXElement:exit'(node) {
        if (
          isTComponent({ context, node: node.openingElement, libs }) ||
          isVariableComponent({ context, node: node.openingElement, libs }) ||
          isDeriveComponent({ context, node: node.openingElement, libs })
        ) {
          scopeStack.pop();
        }
      },
      /**
       * JSXOpeningElement, JSXOpeningElement:exit handle ignoring arguments
       */
      JSXOpeningElement(node) {
        if (
          scopeStack.inTranslatableContent() &&
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
          !scopeStack.inBranchingComponent() ||
          node.value?.type !== TSESTree.AST_NODE_TYPES.JSXExpressionContainer
        ) {
          return;
        }

        // Filter out branching properties, or non-options (null, literals, etc.)
        if (!isContentBranch({ tScope: scopeStack.getScope(), node })) return;
        scopeStack.push('Branching-Attribute');
      },
      'JSXAttribute:exit'(node: TSESTree.JSXAttribute) {
        if (
          !scopeStack.inBranchingAttribute() ||
          node.value?.type !== TSESTree.AST_NODE_TYPES.JSXExpressionContainer
        ) {
          return;
        }

        // Filter out branching properties, or non-options (null, literals, etc.)
        if (!isContentBranch({ tScope: scopeStack.getScope(), node })) return;
        scopeStack.pop();
      },
    };
  },
});
