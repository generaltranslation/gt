/**
 * ESLint rule: no-dynamic-string
 *
 * Ensures translation functions (t, useGT, getGT) only accept string literals
 * as their first argument. Dynamic content like template literals or string
 * concatenation is prohibited to ensure consistent translation keys.
 */

import type { Rule } from 'eslint';

const GT_MODULES = ['gt-next', 'gt-next/client', 'gt-next/server'];
const TRANSLATION_FUNCTIONS = ['useGT', 'getGT'];

interface TrackedFunction {
  name: string;
  isTranslationFunction: boolean;
}

function isGTModule(source: string): boolean {
  return GT_MODULES.includes(source);
}

function isTranslationFunction(name: string): boolean {
  return TRANSLATION_FUNCTIONS.includes(name);
}

export const noDynamicString: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Translation functions must use string literals as the first argument',
      category: 'Best Practices',
      recommended: true,
      url: 'https://github.com/generaltranslation/gt/tree/main/packages/next-lint#no-dynamic-string',
    },
    fixable: undefined,
    schema: [],
    messages: {
      dynamicString: "Translation function must use a constant string literal as the first argument. Use t('Hello, {name}!', { name: value }) instead of template literals or string concatenation.",
    },
  },

  create(context) {
    // Track imported GT functions and their aliases
    const trackedFunctions = new Map<string, TrackedFunction>();
    // Track variables assigned from translation function calls
    const translationVariables = new Set<string>();

    function trackImport(localName: string, importedName: string, source: string) {
      if (isGTModule(source) && isTranslationFunction(importedName)) {
        trackedFunctions.set(localName, {
          name: importedName,
          isTranslationFunction: true,
        });
      }
    }

    function trackNamespaceImport(localName: string, source: string) {
      if (isGTModule(source)) {
        trackedFunctions.set(localName, {
          name: localName,
          isTranslationFunction: false, // It's a namespace, not directly callable
        });
      }
    }

    function isStringLiteral(node: any): boolean {
      return node.type === 'Literal' && typeof node.value === 'string';
    }

    function validateTranslationCall(node: any) {
      const firstArg = node.arguments[0];
      if (!firstArg) return; // No arguments

      if (!isStringLiteral(firstArg)) {
        context.report({
          node: firstArg,
          messageId: 'dynamicString',
        });
      }
    }

    function handleCallExpression(node: any) {
      if (node.callee.type === 'Identifier') {
        // Direct function calls: t(), useGT(), etc.
        const functionName = node.callee.name;

        if (trackedFunctions.has(functionName)) {
          const tracked = trackedFunctions.get(functionName)!;
          if (tracked.isTranslationFunction) {
            validateTranslationCall(node);
          }
        } else if (translationVariables.has(functionName)) {
          // Variable assigned from translation function
          validateTranslationCall(node);
        }
      } else if (node.callee.type === 'MemberExpression') {
        // Member expressions: GT.tx(), namespace.function()
        const objectName = node.callee.object.name;
        const propertyName = node.callee.property.name;

        if (trackedFunctions.has(objectName) && isTranslationFunction(propertyName)) {
          validateTranslationCall(node);
        }
      }
    }

    function handleAssignment(node: any) {
      // Track variables assigned from translation function calls
      if (
        node.type === 'VariableDeclarator' &&
        node.id.type === 'Identifier' &&
        node.init
      ) {
        if (node.init.type === 'CallExpression') {
          const callExpression = node.init;
          
          if (callExpression.callee.type === 'Identifier') {
            const functionName = callExpression.callee.name;
            if (trackedFunctions.has(functionName)) {
              const tracked = trackedFunctions.get(functionName)!;
              if (tracked.isTranslationFunction) {
                // This variable now holds a translation function
                translationVariables.add(node.id.name);
              }
            }
          } else if (callExpression.callee.type === 'MemberExpression') {
            // Handle namespace calls like: const t = GT.useGT();
            const objectName = callExpression.callee.object.name;
            const propertyName = callExpression.callee.property.name;
            if (trackedFunctions.has(objectName) && isTranslationFunction(propertyName)) {
              // This variable now holds a translation function
              translationVariables.add(node.id.name);
            }
          }
        } else if (node.init.type === 'AwaitExpression' && 
                   node.init.argument.type === 'CallExpression') {
          // Handle await getGT() case
          const callExpression = node.init.argument;
          
          if (callExpression.callee.type === 'Identifier') {
            const functionName = callExpression.callee.name;
            if (trackedFunctions.has(functionName)) {
              const tracked = trackedFunctions.get(functionName)!;
              if (tracked.isTranslationFunction) {
                // This variable now holds a translation function (from awaited promise)
                translationVariables.add(node.id.name);
              }
            }
          } else if (callExpression.callee.type === 'MemberExpression') {
            // Handle namespace calls like: const t = await GT.getGT();
            const objectName = callExpression.callee.object.name;
            const propertyName = callExpression.callee.property.name;
            if (trackedFunctions.has(objectName) && isTranslationFunction(propertyName)) {
              // This variable now holds a translation function (from awaited promise)
              translationVariables.add(node.id.name);
            }
          }
        } else if (node.init.type === 'Identifier') {
          // Handle reassignment: const t = getTranslation;
          const assignedFrom = node.init.name;
          if (translationVariables.has(assignedFrom)) {
            translationVariables.add(node.id.name);
          }
        }
      }
    }

    return {
      ImportDeclaration(node: any) {
        const source = node.source.value;
        if (!isGTModule(source)) return;

        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportSpecifier') {
            // import { useGT, tx as serverTx } from 'gt-next'
            const importedName = specifier.imported.name;
            const localName = specifier.local.name;
            trackImport(localName, importedName, source);
          } else if (specifier.type === 'ImportNamespaceSpecifier') {
            // import * as GT from 'gt-next'
            const localName = specifier.local.name;
            trackNamespaceImport(localName, source);
          }
        }
      },

      VariableDeclarator(node: any) {
        handleAssignment(node);
      },

      CallExpression(node: any) {
        handleCallExpression(node);
      },
    };
  },
};