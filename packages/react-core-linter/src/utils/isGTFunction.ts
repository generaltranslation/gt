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
} from './constants.js';
import { RuleContext, Scope } from '@typescript-eslint/utils/ts-eslint';

export type IsGTFunctionOptions = {
  context: Readonly<
    RuleContext<
      'dynamicContent',
      [
        {
          libs: GTLibrary[];
        },
      ]
    >
  >;
  /** Opening or closing element of the component */
  node: TSESTree.JSXOpeningElement | TSESTree.JSXClosingElement;
  libs: readonly GTLibrary[];
  targetName:
    | (typeof GT_COMPONENT_NAMES)[number]
    | (typeof GT_COMPONENT_NAMES)[number][];
};

export function isGTFunction({
  context,
  node,
  libs,
  targetName,
}: IsGTFunctionOptions): boolean {
  // TODO: handle member expressionss
  if (node.name.type !== 'JSXIdentifier') return false;

  // Get the name of the component
  const componentName = node.name.name;

  // Get the component scope
  let scope: Scope.Scope | null = context.sourceCode.getScope(node);
  let variable: Scope.Variable | undefined;
  while (scope) {
    variable = scope.set.get(componentName);
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

export function isStaticComponent({
  context,
  node,
  libs,
}: Omit<IsGTFunctionOptions, 'targetName'>): boolean {
  return isGTFunction({
    context,
    node,
    libs,
    targetName: STATIC_COMPONENT_NAME,
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
