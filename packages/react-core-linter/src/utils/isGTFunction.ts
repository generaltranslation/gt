import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import {
  GT_COMPONENT_NAMES,
  GTLibrary,
  T_COMPONENT_NAME,
  VARIABLE_COMPONENT_NAMES,
  PLURAL_COMPONENT_NAME,
  BRANCH_COMPONENT_NAME,
  BRANCH_COMPONENT_NAMES,
  STATIC_COMPONENT_NAME,
  DERIVE_COMPONENT_NAME,
  DECLARE_STATIC_FUNCTION_NAME,
  DECLARE_DERIVE_FUNCTION_NAME,
  MSG_FUNCTION_NAME,
  GT_CALLBACK_DECLARATOR_FUNCTION_NAMES,
} from './constants.js';
import { RuleContext, Scope } from '@typescript-eslint/utils/ts-eslint';

export type IsGTFunctionOptions = {
  // TODO: better typing
  context: Readonly<RuleContext<any, any>>;
  /** Opening or closing element of the component
   * TODO: make this more selective (eg differentiate btwn JSX and Function calls)
   */
  node:
    | TSESTree.JSXOpeningElement
    | TSESTree.JSXClosingElement
    | TSESTree.CallExpression;
  libs: readonly GTLibrary[];
  targetName:
    | (typeof GT_COMPONENT_NAMES)[number]
    | (typeof GT_COMPONENT_NAMES)[number][];
};

/**
 * Extract identifier name from a node
 * @param node - JSXOpeningElement, JSXClosingElement, or CallExpression
 * @returns
 *
 * TODO: handle member expressions
 */

function getIdentifierName(
  node:
    | TSESTree.JSXOpeningElement
    | TSESTree.JSXClosingElement
    | TSESTree.CallExpression
): string | null {
  if (
    node.type === AST_NODE_TYPES.JSXOpeningElement ||
    node.type === AST_NODE_TYPES.JSXClosingElement
  ) {
    if (node.name.type === AST_NODE_TYPES.JSXIdentifier) {
      return node.name.name;
    }
  } else if (node.type === AST_NODE_TYPES.CallExpression) {
    if (node.callee.type === AST_NODE_TYPES.Identifier) {
      return node.callee.name;
    }
  }
  return null;
}

export function isGTFunction({
  context,
  node,
  libs,
  targetName,
}: IsGTFunctionOptions): boolean {
  // Get the name of the identifier
  const identifierName = getIdentifierName(node);
  if (identifierName === null) return false;

  // Get the scope
  let scope: Scope.Scope | null = context.sourceCode.getScope(node);
  let variable: Scope.Variable | undefined;
  while (scope) {
    variable = scope.set.get(identifierName);
    if (variable) break;
    scope = scope.upper;
  }
  if (!variable) {
    return false;
  }

  // Check import type
  if (
    variable.defs.length === 0 ||
    variable.defs[0].type !== 'ImportBinding' ||
    variable.defs[0].node.type !== AST_NODE_TYPES.ImportSpecifier
  ) {
    return false;
  }

  // Check name (eg T as GT, Var, etc)
  const resolvedImportName =
    variable.defs[0].node.imported.type === AST_NODE_TYPES.Identifier
      ? variable.defs[0].node.imported.name
      : variable.defs[0].node.imported.value;
  if (
    (typeof targetName === 'string' && resolvedImportName !== targetName) ||
    (Array.isArray(targetName) &&
      !targetName.includes(
        resolvedImportName as (typeof GT_COMPONENT_NAMES)[number]
      ))
  ) {
    return false;
  }

  // Check import source
  const importDecl = variable.defs[0].parent;
  if (
    importDecl.type !== AST_NODE_TYPES.ImportDeclaration ||
    !libs.includes(importDecl.source.value as unknown as GTLibrary)
  ) {
    return false;
  }

  return true;
}

export function isTComponent({
  context,
  node,
  libs,
}: Omit<IsGTFunctionOptions, 'targetName'>): boolean {
  return isGTFunction({
    context,
    node,
    libs,
    targetName: T_COMPONENT_NAME,
  });
}

export function isDeriveComponent({
  context,
  node,
  libs,
}: Omit<IsGTFunctionOptions, 'targetName'>): boolean {
  return (
    isGTFunction({
      context,
      node,
      libs,
      targetName: DERIVE_COMPONENT_NAME,
    }) ||
    isGTFunction({
      context,
      node,
      libs,
      targetName: STATIC_COMPONENT_NAME,
    })
  );
}

/**
 * @deprecated Use `isDeriveComponent` instead.
 */
export const isStaticComponent = isDeriveComponent;

export function isVariableComponent({
  context,
  node,
  libs,
}: Omit<IsGTFunctionOptions, 'targetName'>): boolean {
  return isGTFunction({
    context,
    node,
    libs,
    targetName: VARIABLE_COMPONENT_NAMES,
  });
}

export function isBranchComponent({
  context,
  node,
  libs,
}: Omit<IsGTFunctionOptions, 'targetName'>): boolean {
  return isGTFunction({
    context,
    node,
    libs,
    targetName: BRANCH_COMPONENT_NAME,
  });
}

export function isPluralComponent({
  context,
  node,
  libs,
}: Omit<IsGTFunctionOptions, 'targetName'>): boolean {
  return isGTFunction({
    context,
    node,
    libs,
    targetName: PLURAL_COMPONENT_NAME,
  });
}

export function isBranchingComponent({
  context,
  node,
  libs,
}: Omit<IsGTFunctionOptions, 'targetName'>): boolean {
  return isGTFunction({
    context,
    node,
    libs,
    targetName: BRANCH_COMPONENT_NAMES,
  });
}

export function isDeriveFunction({
  context,
  node,
  libs,
}: Omit<IsGTFunctionOptions, 'targetName'>): boolean {
  return (
    isGTFunction({
      context,
      node,
      libs,
      targetName: DECLARE_DERIVE_FUNCTION_NAME,
    }) ||
    isGTFunction({
      context,
      node,
      libs,
      targetName: DECLARE_STATIC_FUNCTION_NAME,
    })
  );
}

/**
 * @deprecated Use `isDeriveFunction` instead.
 */
export const isDeclareStaticFunction = isDeriveFunction;

export function isMsgFunction({
  context,
  node,
  libs,
}: Omit<IsGTFunctionOptions, 'targetName'>): boolean {
  return isGTFunction({
    context,
    node,
    libs,
    targetName: MSG_FUNCTION_NAME,
  });
}

export function isGTCallbackFunction({
  context,
  node,
  libs,
}: Omit<IsGTFunctionOptions, 'targetName'>): boolean {
  // -- Step 1: Get binding for the gt identifier -- //
  const identifierName = getIdentifierName(node);
  if (identifierName === null) return false;

  // Find the variable declaration in scope
  let scope: Scope.Scope | null = context.sourceCode.getScope(node);
  let variable: Scope.Variable | undefined;
  while (scope) {
    variable = scope.set.get(identifierName);
    if (variable) break;
    scope = scope.upper;
  }
  if (!variable) {
    return false;
  }

  // -- Step 2: Check if the variable was declared with useGT() or await getGT() -- //
  // Helper function
  function isGTDeclaratorCallExpression(
    node: TSESTree.CallExpression
  ): boolean {
    return isGTFunction({
      context,
      node,
      libs,
      targetName: GT_CALLBACK_DECLARATOR_FUNCTION_NAMES,
    });
  }

  // Find the first variable declarator definition (const gt = ...)
  const variableDef = variable.defs.find(
    (def) =>
      def.type === 'Variable' &&
      def.node.type === AST_NODE_TYPES.VariableDeclarator
  ) as Scope.Definitions.VariableDefinition | undefined;
  const init = variableDef?.node.init;
  if (!init) return false;

  // -- Step 3: Check the import -- //

  // Case 1: const gt = useGT()
  if (
    init.type === AST_NODE_TYPES.CallExpression &&
    isGTDeclaratorCallExpression(init)
  ) {
    return true;
  }

  // Case 2: const gt = await getGT()
  if (
    libs.includes('gt-next') &&
    init.type === AST_NODE_TYPES.AwaitExpression &&
    init.argument.type === AST_NODE_TYPES.CallExpression &&
    isGTDeclaratorCallExpression(init.argument)
  ) {
    return true;
  }

  return false;
}
