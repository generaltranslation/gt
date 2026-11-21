import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import {
  GT_COMPONENT_NAMES,
  GTLibrary,
  T_COMPONENT_NAME,
  VARIABLE_COMPONENT_NAMES,
  PLURAL_COMPONENT_NAME,
  SELECT_COMPONENT_NAME,
  BRANCH_COMPONENT_NAMES,
  DERIVE_COMPONENT_NAME,
  MSG_FUNCTION_NAME,
  isGTLibrarySource,
} from './constants.js';
import { RuleContext, Scope } from '@typescript-eslint/utils/ts-eslint';

export type IsGTFunctionOptions = {
  context: Readonly<RuleContext<string, readonly unknown[]>>;
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
    !isGTLibrarySource(libs, importDecl.source.value)
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
  return isGTFunction({
    context,
    node,
    libs,
    targetName: DERIVE_COMPONENT_NAME,
  });
}

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
    targetName: SELECT_COMPONENT_NAME,
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
