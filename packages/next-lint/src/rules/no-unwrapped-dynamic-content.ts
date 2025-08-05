/**
 * ESLint rule: no-unwrapped-dynamic-content
 *
 * Detects unwrapped dynamic content in GT-Next translation components.
 * Equivalent to the SWC plugin functionality but with proper ESLint error reporting.
 *
 * This rule checks for JSX expressions ({dynamic content}) inside <T> components
 * that are not wrapped in variable components (<Var>, <DateTime>, <Num>, <Currency>).
 */

import type { Rule } from 'eslint';

const GT_MODULES = ['gt-next', 'gt-next/client', 'gt-next/server'];
const TRANSLATION_COMPONENTS = ['T'];
const VARIABLE_COMPONENTS = ['Var', 'DateTime', 'Num', 'Currency'];

function isGTModule(source: string): boolean {
  return GT_MODULES.includes(source);
}

function isTranslationComponent(name: string): boolean {
  return TRANSLATION_COMPONENTS.includes(name);
}

function isVariableComponent(name: string): boolean {
  return VARIABLE_COMPONENTS.includes(name);
}

export const noUnwrappedDynamicContent: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Detect unwrapped dynamic content in GT-Next translation components',
      category: 'Best Practices',
      recommended: true,
      url: 'https://github.com/generaltranslation/gt/tree/main/packages/next-lint#no-unwrapped-dynamic-content',
    },
    fixable: undefined,
    schema: [
      {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['error', 'warn'],
            default: 'warn',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unwrappedDynamicContent:
        'Dynamic content in <T> component should be wrapped in a variable component (<Var>, <DateTime>, <Num>, or <Currency>)',
    },
  },

  create(context) {
    const state = {
      translationStack: 0,
      variableStack: 0,
      imports: {
        translationComponents: new Set<string>(),
        variableComponents: new Set<string>(),
        namespaceImports: new Set<string>(),
        assignedTranslationComponents: new Set<string>(),
        assignedVariableComponents: new Set<string>(),
      },
    };

    function getElementName(node: any): string | null {
      const name = node?.openingElement?.name;
      if (!name) return null;

      if (name.type === 'JSXIdentifier') {
        return name.name;
      }

      if (name.type === 'JSXMemberExpression') {
        const obj = name.object;
        const prop = name.property;
        if (obj?.type === 'JSXIdentifier' && prop?.type === 'JSXIdentifier') {
          return `${obj.name}.${prop.name}`;
        }
      }

      return null;
    }

    function isNamespaceTranslationComponent(elementName: string): boolean {
      const parts = elementName.split('.');
      if (parts.length === 2) {
        const [namespace, component] = parts;
        return (
          state.imports.namespaceImports.has(namespace) &&
          isTranslationComponent(component)
        );
      }
      return false;
    }

    function isNamespaceVariableComponent(elementName: string): boolean {
      const parts = elementName.split('.');
      if (parts.length === 2) {
        const [namespace, component] = parts;
        return (
          state.imports.namespaceImports.has(namespace) &&
          isVariableComponent(component)
        );
      }
      return false;
    }

    return {
      // Track imports from GT-Next modules
      ImportDeclaration(node: any) {
        if (
          node.source?.type === 'Literal' &&
          typeof node.source.value === 'string'
        ) {
          const source = node.source.value;

          if (isGTModule(source)) {
            for (const specifier of node.specifiers || []) {
              if (specifier.type === 'ImportSpecifier') {
                const importedName = specifier.imported?.name || '';
                const localName = specifier.local?.name || '';

                if (isTranslationComponent(importedName)) {
                  state.imports.translationComponents.add(localName);
                } else if (isVariableComponent(importedName)) {
                  state.imports.variableComponents.add(localName);
                }
              } else if (specifier.type === 'ImportNamespaceSpecifier') {
                const localName = specifier.local?.name || '';
                state.imports.namespaceImports.add(localName);
              }
            }
          }
        }
      },

      // Track variable assignments from GT components
      VariableDeclarator(node: any) {
        if (
          node.id?.type === 'Identifier' &&
          node.init?.type === 'Identifier'
        ) {
          const varName = node.id.name;
          const assignedFrom = node.init.name;

          if (state.imports.translationComponents.has(assignedFrom)) {
            state.imports.assignedTranslationComponents.add(varName);
          } else if (state.imports.variableComponents.has(assignedFrom)) {
            state.imports.assignedVariableComponents.add(varName);
          }
        }
      },

      // Detect unwrapped dynamic content
      JSXExpressionContainer(node: any) {
        // Check if this expression is inside a translation component but not inside a variable component
        let inTranslationComponent = false;
        let inVariableComponent = false;

        // Walk up the AST to find parent JSX elements
        let currentNode = node.parent;
        while (currentNode) {
          if (currentNode.type === 'JSXElement') {
            const elementName = getElementName(currentNode);
            if (elementName) {
              // Check if this is a variable component
              if (
                state.imports.variableComponents.has(elementName) ||
                state.imports.assignedVariableComponents.has(elementName) ||
                isNamespaceVariableComponent(elementName)
              ) {
                inVariableComponent = true;
                break; // If we find a variable component, we don't need to check further
              }
              // Check if this is a translation component
              else if (
                state.imports.translationComponents.has(elementName) ||
                state.imports.assignedTranslationComponents.has(elementName) ||
                isNamespaceTranslationComponent(elementName)
              ) {
                inTranslationComponent = true;
              }
            }
          }
          currentNode = currentNode.parent;
        }

        // Report if we're inside a translation component but not inside a variable component
        if (inTranslationComponent && !inVariableComponent) {
          context.report({
            node,
            messageId: 'unwrappedDynamicContent',
          });
        }
      },
    };
  },
};
