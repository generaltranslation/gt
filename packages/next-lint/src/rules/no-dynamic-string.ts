/**
 * ESLint rule: no-dynamic-string
 *
 * Ensures translation functions (t, useGT, getGT) only accept string literals
 * as their first argument. Dynamic content like template literals or string
 * concatenation is prohibited to ensure consistent translation keys.
 */

import type { Rule } from 'eslint';
import { getNodeName, isAstNode, isGTModule, isStringLiteral } from './utils';

const TRANSLATION_FUNCTIONS = ['useGT', 'getGT'];

interface TrackedFunction {
  name: string;
  isTranslationFunction: boolean;
}

function isTranslationFunction(name: string): boolean {
  return TRANSLATION_FUNCTIONS.includes(name);
}

export const noDynamicString: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Translation functions must use string literals as the first argument',
      category: 'Best Practices',
      recommended: true,
      url: 'https://github.com/generaltranslation/gt/tree/main/packages/next-lint#no-dynamic-string',
    },
    fixable: undefined,
    schema: [],
    messages: {
      dynamicString:
        "Translation function must use a constant string literal as the first argument. Use t('Hello, {name}!', { name: value }) instead of template literals or string concatenation.",
    },
  },

  create(context) {
    // Track imported GT functions and their aliases
    const trackedFunctions = new Map<string, TrackedFunction>();
    // Track variables assigned from translation function calls
    const translationVariables = new Set<string>();

    function trackImport(
      localName: string,
      importedName: string,
      source: string
    ) {
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

    function validateTranslationCall(node: unknown) {
      if (!isAstNode(node) || !Array.isArray(node.arguments)) return;
      const firstArg = node.arguments[0];
      if (!firstArg) return; // No arguments

      if (!isStringLiteral(firstArg)) {
        context.report({
          node: firstArg as never,
          messageId: 'dynamicString',
        });
      }
    }

    function handleCallExpression(node: unknown) {
      if (!isAstNode(node) || !isAstNode(node.callee)) return;
      if (node.callee.type === 'Identifier') {
        // Direct function calls: t(), useGT(), etc.
        const functionName = getNodeName(node.callee);
        if (!functionName) return;

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
        const objectName = getNodeName(node.callee.object);
        const propertyName = getNodeName(node.callee.property);
        if (!objectName || !propertyName) return;

        if (
          trackedFunctions.has(objectName) &&
          isTranslationFunction(propertyName)
        ) {
          validateTranslationCall(node);
        }
      }
    }

    function handleAssignment(node: unknown) {
      // Track variables assigned from translation function calls
      if (
        isAstNode(node) &&
        node.type === 'VariableDeclarator' &&
        isAstNode(node.id) &&
        node.id.type === 'Identifier' &&
        isAstNode(node.init)
      ) {
        if (node.init.type === 'CallExpression') {
          const callExpression = node.init;

          if (
            isAstNode(callExpression.callee) &&
            callExpression.callee.type === 'Identifier'
          ) {
            const functionName = getNodeName(callExpression.callee);
            if (!functionName) return;
            if (trackedFunctions.has(functionName)) {
              const tracked = trackedFunctions.get(functionName)!;
              if (tracked.isTranslationFunction) {
                // This variable now holds a translation function
                const variableName = getNodeName(node.id);
                if (variableName) translationVariables.add(variableName);
              }
            }
          } else if (
            isAstNode(callExpression.callee) &&
            callExpression.callee.type === 'MemberExpression'
          ) {
            // Handle namespace calls like: const t = GT.useGT();
            const objectName = getNodeName(callExpression.callee.object);
            const propertyName = getNodeName(callExpression.callee.property);
            if (
              objectName &&
              propertyName &&
              trackedFunctions.has(objectName) &&
              isTranslationFunction(propertyName)
            ) {
              // This variable now holds a translation function
              const variableName = getNodeName(node.id);
              if (variableName) translationVariables.add(variableName);
            }
          }
        } else if (
          node.init.type === 'AwaitExpression' &&
          isAstNode(node.init.argument) &&
          node.init.argument.type === 'CallExpression'
        ) {
          // Handle await getGT() case
          const callExpression = node.init.argument;

          if (
            isAstNode(callExpression.callee) &&
            callExpression.callee.type === 'Identifier'
          ) {
            const functionName = getNodeName(callExpression.callee);
            if (!functionName) return;
            if (trackedFunctions.has(functionName)) {
              const tracked = trackedFunctions.get(functionName)!;
              if (tracked.isTranslationFunction) {
                // This variable now holds a translation function (from awaited promise)
                const variableName = getNodeName(node.id);
                if (variableName) translationVariables.add(variableName);
              }
            }
          } else if (
            isAstNode(callExpression.callee) &&
            callExpression.callee.type === 'MemberExpression'
          ) {
            // Handle namespace calls like: const t = await GT.getGT();
            const objectName = getNodeName(callExpression.callee.object);
            const propertyName = getNodeName(callExpression.callee.property);
            if (
              objectName &&
              propertyName &&
              trackedFunctions.has(objectName) &&
              isTranslationFunction(propertyName)
            ) {
              // This variable now holds a translation function (from awaited promise)
              const variableName = getNodeName(node.id);
              if (variableName) translationVariables.add(variableName);
            }
          }
        } else if (node.init.type === 'Identifier') {
          // Handle reassignment: const t = getTranslation;
          const assignedFrom = getNodeName(node.init);
          if (assignedFrom && translationVariables.has(assignedFrom)) {
            const variableName = getNodeName(node.id);
            if (variableName) translationVariables.add(variableName);
          }
        }
      }
    }

    return {
      ImportDeclaration(node: unknown) {
        if (!isAstNode(node) || !isAstNode(node.source)) return;
        const source = node.source.value;
        if (typeof source !== 'string') return;
        if (!isGTModule(source)) return;

        const specifiers = Array.isArray(node.specifiers)
          ? node.specifiers
          : [];
        for (const specifier of specifiers) {
          if (!isAstNode(specifier)) continue;
          if (specifier.type === 'ImportSpecifier') {
            // import { useGT, tx as serverTx } from 'gt-next'
            const importedName = getNodeName(specifier.imported);
            const localName = getNodeName(specifier.local);
            if (importedName && localName) {
              trackImport(localName, importedName, source);
            }
          } else if (specifier.type === 'ImportNamespaceSpecifier') {
            // import * as GT from 'gt-next'
            const localName = getNodeName(specifier.local);
            if (localName) trackNamespaceImport(localName, source);
          }
        }
      },

      VariableDeclarator(node: unknown) {
        handleAssignment(node);
      },

      CallExpression(node: unknown) {
        handleCallExpression(node);
      },
    };
  },
};
