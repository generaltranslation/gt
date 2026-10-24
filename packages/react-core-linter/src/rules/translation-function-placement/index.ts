import {
  AST_NODE_TYPES,
  ESLintUtils,
  TSESTree,
} from '@typescript-eslint/utils';
import { GTLibrary, RULE_URL } from '../../utils/constants.js';
import { isGTFunction } from '../../utils/isGTFunction.js';

const createRule = ESLintUtils.RuleCreator((name) => `${RULE_URL}${name}`);

// Each function that reads the current request or browser, and the hook
// components use instead.
const HOOKS: Record<string, string> = {
  getGT: 'useGT',
  getMessages: 'useMessages',
  getTranslations: 'useTranslations',
  getLocale: 'useLocale',
  getEnableI18n: 'useEnableI18n',
};

// gt-next's versions are server-only, and valid in async Server Components.
const DEFAULT_LIBS: GTLibrary[] = ['gt-tanstack-start'];

type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

function isFunction(node: TSESTree.Node): node is FunctionNode {
  return (
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression ||
    node.type === AST_NODE_TYPES.ArrowFunctionExpression
  );
}

function getEnclosingFunction(node: TSESTree.Node): FunctionNode | undefined {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (isFunction(parent)) return parent;
  }
  return undefined;
}

function getCalleeName(callee: TSESTree.Expression): string | undefined {
  if (callee.type === AST_NODE_TYPES.Identifier) return callee.name;
  if (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    callee.property.type === AST_NODE_TYPES.Identifier
  ) {
    return callee.property.name;
  }
  return undefined;
}

// Names as eslint-plugin-react-hooks reads them.
const isHookName = (name: string) => /^use[A-Z0-9]/.test(name);

/** Whether the node is passed to a function with one of these names. */
function isArgumentOf(node: TSESTree.Node, names: (name: string) => boolean) {
  const { parent } = node;
  if (parent?.type !== AST_NODE_TYPES.CallExpression) return false;
  if (parent.callee === node) return false;
  const name = getCalleeName(parent.callee);
  return name !== undefined && names(name);
}

/**
 * Whether the function runs as part of the scope around it: called right
 * where it's defined, like `(() => …)()`, or by a hook during render or in an
 * effect. useCallback stores its callback for later, like an event handler.
 */
function runsWithEnclosingScope(fn: FunctionNode): boolean {
  return (
    (fn.parent?.type === AST_NODE_TYPES.CallExpression &&
      fn.parent.callee === fn) ||
    isArgumentOf(fn, (name) => isHookName(name) && name !== 'useCallback')
  );
}

const isComponentWrapper = (name: string) =>
  name === 'memo' || name === 'forwardRef';

/**
 * The name a function is declared or assigned under, looking through memo()
 * and forwardRef(). A function expression's own name, as in
 * `component: function render() {}`, is only a fallback.
 */
function getFunctionName(fn: FunctionNode): string | undefined {
  if (fn.type === AST_NODE_TYPES.FunctionDeclaration) return fn.id?.name;
  let node: TSESTree.Node = fn;
  while (isArgumentOf(node, isComponentWrapper)) {
    node = node.parent as TSESTree.Node;
  }
  const { parent } = node;
  if (
    parent?.type === AST_NODE_TYPES.VariableDeclarator &&
    parent.id.type === AST_NODE_TYPES.Identifier
  ) {
    return parent.id.name;
  }
  if (
    parent?.type === AST_NODE_TYPES.Property &&
    parent.key.type === AST_NODE_TYPES.Identifier
  ) {
    return parent.key.name;
  }
  return fn.id?.name;
}

/**
 * Components start with a capital letter, hooks with use. Route options such
 * as component and pendingComponent take components too.
 */
function rendersDuringRender(name: string): boolean {
  return (
    /^[A-Z]/.test(name) ||
    isHookName(name) ||
    name === 'component' ||
    name.endsWith('Component')
  );
}

function isJsx(node: TSESTree.Node | null | undefined): boolean {
  if (!node) return false;
  if (node.type === AST_NODE_TYPES.ConditionalExpression) {
    return isJsx(node.consequent) || isJsx(node.alternate);
  }
  if (node.type === AST_NODE_TYPES.LogicalExpression) return isJsx(node.right);
  return (
    node.type === AST_NODE_TYPES.JSXElement ||
    node.type === AST_NODE_TYPES.JSXFragment
  );
}

/** Whether the function itself, not a nested one, returns JSX. */
function returnsJsx(fn: FunctionNode): boolean {
  if (fn.body.type !== AST_NODE_TYPES.BlockStatement) return isJsx(fn.body);
  const visit = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(visit);
    if (!value || typeof value !== 'object' || !('type' in value)) {
      return false;
    }
    const node = value as TSESTree.Node;
    if (node.type === AST_NODE_TYPES.ReturnStatement) {
      return isJsx(node.argument);
    }
    if (isFunction(node)) return false;
    return Object.entries(node).some(
      ([key, child]) => key !== 'parent' && visit(child)
    );
  };
  return visit(fn.body.body);
}

/**
 * Whether the function renders: memo() and forwardRef() take components
 * whatever their names.
 */
function isComponentOrHook(fn: FunctionNode): boolean {
  if (isArgumentOf(fn, isComponentWrapper)) return true;
  const name = getFunctionName(fn);
  return (
    (name !== undefined && rendersDuringRender(name)) ||
    isAnonymousDefaultComponent(fn)
  );
}

/** An unnamed `export default` function that renders, such as a page. */
function isAnonymousDefaultComponent(fn: FunctionNode): boolean {
  return (
    !fn.id &&
    fn.parent?.type === AST_NODE_TYPES.ExportDefaultDeclaration &&
    returnsJsx(fn)
  );
}

export const translationFunctionPlacement = createRule({
  name: 'translation-function-placement',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Call getGT() and the other request-scoped translation functions from route loaders, head data and server functions, not at module scope or in components.',
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
              'List of library modules whose translation functions to check',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      moduleScope:
        '{{name}}() reads the locale of the current request or browser, so at module scope it runs once and reuses that locale for every later request. Call it inside a route loader, head data or server function.',
      inComponent:
        '{{name}}() is for route loaders, head data and server functions. In components and hooks, use {{hook}}() instead.',
    },
  },
  defaultOptions: [{ libs: DEFAULT_LIBS }],
  create(context, [options]) {
    const { libs = DEFAULT_LIBS } = options;

    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (node.callee.type !== AST_NODE_TYPES.Identifier) return;
        const name = Object.keys(HOOKS).find((targetName) =>
          isGTFunction({
            context,
            node,
            libs,
            targetName,
          })
        );
        if (!name) return;

        let fn = getEnclosingFunction(node);
        while (fn && runsWithEnclosingScope(fn)) fn = getEnclosingFunction(fn);
        if (!fn) {
          context.report({ node, messageId: 'moduleScope', data: { name } });
          return;
        }
        if (isComponentOrHook(fn)) {
          context.report({
            node,
            messageId: 'inComponent',
            data: { name, hook: HOOKS[name] },
          });
        }
      },
    };
  },
});
