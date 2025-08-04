import { Rule } from 'eslint';

interface ComponentImportInfo {
  localName: string;
  importedName: string;
  type: 'translation' | 'variable';
}

interface RuleContext {
  inTranslationComponent: boolean;
  inVariableComponent: boolean;
  gtImports: Map<string, ComponentImportInfo>;
}

/**
 * ESLint rule to detect unwrapped dynamic content in GT-Next translation components
 * Provides IDE integration with real-time feedback
 */
export const noUnwrappedDynamicContent: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Detect unwrapped dynamic content in GT-Next translation components',
      category: 'Possible Errors',
      recommended: true,
      url: 'https://docs.generaltranslation.com/next/guides/variables'
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          checkTranslationComponents: {
            type: 'boolean',
            default: true
          },
          variableComponents: {
            type: 'array',
            items: { type: 'string' },
            default: ['Var', 'DateTime', 'Num', 'Currency']
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      unwrappedDynamicContent: 'Dynamic content in translation component should be wrapped in a variable component like <Var>, <DateTime>, <Num>, or <Currency>',
      unwrappedDynamicContentWithSuggestion: 'Dynamic content in <{{componentName}}> should be wrapped in <Var>, <DateTime>, <Num>, or <Currency>'
    }
  },

  create(context: Rule.RuleContext): Rule.RuleListener {
    const options = context.options[0] || {};
    const checkTranslationComponents = options.checkTranslationComponents !== false;
    const variableComponents = options.variableComponents || ['Var', 'DateTime', 'Num', 'Currency'];

    if (!checkTranslationComponents) return {};

    const ruleContext: RuleContext = {
      inTranslationComponent: false,
      inVariableComponent: false,
      gtImports: new Map()
    };

    function isGTNextModule(modulePath: string): boolean {
      return ['gt-next', 'gt-next/client', 'gt-next/server'].includes(modulePath);
    }

    function getComponentType(componentName: string): 'translation' | 'variable' | null {
      if (componentName === 'T') {
        return 'translation';
      }
      if (variableComponents.includes(componentName)) {
        return 'variable';
      }
      return null;
    }

    function processImportDeclaration(node: any): void {
      if (!node.source.value || typeof node.source.value !== 'string') return;
      
      const modulePath = node.source.value;
      if (!isGTNextModule(modulePath)) return;

      if (node.specifiers) {
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportSpecifier') {
            const localName = specifier.local.name;
            const importedName = specifier.imported.type === 'Identifier' 
              ? specifier.imported.name 
              : localName;
            
            const componentType = getComponentType(importedName);
            if (componentType) {
              ruleContext.gtImports.set(localName, {
                localName,
                importedName,
                type: componentType
              });
            }
          }
        }
      }
    }

    function processJSXElement(node: any): void {
      const tagName = getJSXTagName(node);
      if (!tagName) return;

      const gtComponent = ruleContext.gtImports.get(tagName);
      if (!gtComponent) return;

      // Save current state
      const wasInTranslation = ruleContext.inTranslationComponent;
      const wasInVariable = ruleContext.inVariableComponent;

      // Update context based on component type
      if (gtComponent.type === 'translation') {
        ruleContext.inTranslationComponent = true;
      } else if (gtComponent.type === 'variable') {
        ruleContext.inVariableComponent = true;
      }

      // The ESLint traversal will handle visiting children
      // We'll restore the state in the exit function
      
      return {
        exit() {
          ruleContext.inTranslationComponent = wasInTranslation;
          ruleContext.inVariableComponent = wasInVariable;
        }
      };
    }

    function getJSXTagName(node: any): string | null {
      const openingElement = node.type === 'JSXElement' ? node.openingElement : node;
      
      if (openingElement.name.type === 'JSXIdentifier') {
        return openingElement.name.name;
      }
      return null;
    }

    function processJSXExpressionContainer(node: any): void {
      // Only warn if we're inside a translation component but NOT inside a variable component
      if (ruleContext.inTranslationComponent && !ruleContext.inVariableComponent) {
        context.report({
          node,
          messageId: 'unwrappedDynamicContent'
        });
      }
    }

    return {
      ImportDeclaration: processImportDeclaration,
      JSXElement: processJSXElement,
      JSXSelfClosingElement: processJSXElement,
      JSXExpressionContainer: processJSXExpressionContainer
    };
  }
};