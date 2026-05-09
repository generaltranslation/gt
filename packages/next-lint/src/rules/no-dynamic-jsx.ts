/**
 * ESLint rule: no-dynamic-jsx
 *
 * Detects unwrapped dynamic content in GT-Next translation components.
 * Equivalent to the SWC plugin functionality but with proper ESLint error reporting.
 *
 * This rule checks for JSX expressions ({dynamic content}) inside <T> components
 * that are not wrapped in variable components (<Var>, <DateTime>, <Num>, <Currency>).
 */

import type { Rule } from 'eslint';
import { getNodeName, isAstNode, isGTModule, isStringLiteral } from './utils';

const TRANSLATION_COMPONENTS = ['T'];
const VARIABLE_COMPONENTS = ['Var', 'DateTime', 'Num', 'Currency'];

function isTranslationComponent(name: string): boolean {
  return TRANSLATION_COMPONENTS.includes(name);
}

function isVariableComponent(name: string): boolean {
  return VARIABLE_COMPONENTS.includes(name);
}

export const noDynamicJsx: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Detect unwrapped dynamic content in GT-Next translation components',
      category: 'Best Practices',
      recommended: true,
      url: 'https://github.com/generaltranslation/gt/tree/main/packages/next-lint#no-dynamic-jsx',
    },
    fixable: undefined,
    schema: [],
    messages: {
      dynamicJsx:
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

    function getElementName(node: unknown): string | null {
      if (!isAstNode(node) || !isAstNode(node.openingElement)) return null;
      const name = node.openingElement.name;
      if (!isAstNode(name)) return null;

      if (name.type === 'JSXIdentifier') {
        return getNodeName(name);
      }

      if (name.type === 'JSXMemberExpression') {
        const obj = name.object;
        const prop = name.property;
        if (
          isAstNode(obj) &&
          isAstNode(prop) &&
          obj.type === 'JSXIdentifier' &&
          prop.type === 'JSXIdentifier'
        ) {
          const objectName = getNodeName(obj);
          const propertyName = getNodeName(prop);
          return objectName && propertyName
            ? `${objectName}.${propertyName}`
            : null;
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

    function isInsideJSXAttribute(node: unknown): boolean {
      if (!isAstNode(node)) return false;
      // Walk up the AST to check if this expression is inside a JSX attribute
      let currentNode = isAstNode(node.parent) ? node.parent : null;
      while (currentNode) {
        if (currentNode.type === 'JSXAttribute') {
          return true;
        }
        // If we reach a JSX element, we're in element content, not attributes
        if (currentNode.type === 'JSXElement') {
          return false;
        }
        currentNode = isAstNode(currentNode.parent) ? currentNode.parent : null;
      }
      return false;
    }

    // Check if the node is a comment
    function isComment(expression: unknown): boolean {
      if (!isAstNode(expression)) return false;
      return expression.type === 'Block' || expression.type === 'Line';
    }

    // Check if empty
    function isEmpty(expression: unknown): boolean {
      if (!isAstNode(expression)) return false;
      return expression.type === 'JSXEmptyExpression';
    }

    return {
      // Track imports from GT-Next modules
      ImportDeclaration(node: unknown) {
        if (!isAstNode(node) || !isAstNode(node.source)) return;
        if (
          node.source?.type === 'Literal' &&
          typeof node.source.value === 'string'
        ) {
          const source = node.source.value;

          if (isGTModule(source)) {
            const specifiers = Array.isArray(node.specifiers)
              ? node.specifiers
              : [];
            for (const specifier of specifiers) {
              if (!isAstNode(specifier)) continue;
              if (specifier.type === 'ImportSpecifier') {
                const importedName = getNodeName(specifier.imported) || '';
                const localName = getNodeName(specifier.local) || '';

                if (isTranslationComponent(importedName)) {
                  state.imports.translationComponents.add(localName);
                } else if (isVariableComponent(importedName)) {
                  state.imports.variableComponents.add(localName);
                }
              } else if (specifier.type === 'ImportNamespaceSpecifier') {
                const localName = getNodeName(specifier.local) || '';
                state.imports.namespaceImports.add(localName);
              }
            }
          }
        }
      },

      // Track variable assignments from GT components
      VariableDeclarator(node: unknown) {
        if (
          isAstNode(node) &&
          isAstNode(node.id) &&
          isAstNode(node.init) &&
          node.id.type === 'Identifier' &&
          node.init.type === 'Identifier'
        ) {
          const varName = getNodeName(node.id);
          const assignedFrom = getNodeName(node.init);
          if (!varName || !assignedFrom) return;

          if (state.imports.translationComponents.has(assignedFrom)) {
            state.imports.assignedTranslationComponents.add(varName);
          } else if (state.imports.variableComponents.has(assignedFrom)) {
            state.imports.assignedVariableComponents.add(varName);
          }
        }
      },

      // Detect unwrapped dynamic content
      JSXExpressionContainer(node: unknown) {
        if (!isAstNode(node)) return;
        // Skip expressions inside JSX attributes (e.g., <Image width={16} />)
        if (isInsideJSXAttribute(node)) {
          return;
        }

        // Skip expressions with just a string literal (e.g., {'Hello'})
        // Skip expressions with just a comment
        // Skip expressions with just an empty statement
        if (
          (node.expression && isStringLiteral(node.expression)) ||
          isComment(node.expression) ||
          isEmpty(node.expression)
        ) {
          return;
        }

        // Check if this expression is inside a translation component but not inside a variable component
        let inTranslationComponent = false;
        let inVariableComponent = false;

        // Walk up the AST to find parent JSX elements
        let currentNode = isAstNode(node.parent) ? node.parent : null;
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
          currentNode = isAstNode(currentNode.parent)
            ? currentNode.parent
            : null;
        }

        // Report if we're inside a translation component but not inside a variable component
        if (inTranslationComponent && !inVariableComponent) {
          context.report({
            node: node as never,
            messageId: 'dynamicJsx',
          });
        }
      },
    };
  },
};
