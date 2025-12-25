import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import {
  GT_COMPONENT_NAMES,
  GTLibrary,
  T_COMPONENT_NAME,
} from '../utils/constants.js';
import { RuleContext, Scope } from '@typescript-eslint/utils/ts-eslint';

export type IsGTComponentOptions = {
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
  node: TSESTree.JSXOpeningElement;
  libs: readonly GTLibrary[];
  targetComponentName: (typeof GT_COMPONENT_NAMES)[number];
};

export function isGTComponent({
  context,
  node,
  libs,
  targetComponentName,
}: IsGTComponentOptions): boolean {
  // TODO: handle member expressionss
  if (node.name.type !== 'JSXIdentifier') return false;

  // Get the name of the component
  const componentName = node.name.name;

  let doDebug = false;
  if (componentName === 'T') doDebug = true;

  // Get the component scope
  let scope: Scope.Scope | null = context.sourceCode.getScope(node);
  let variable: Scope.Variable | undefined;
  while (scope) {
    variable = scope.set.get(componentName);
    if (variable) break;
    scope = scope.upper;
  }
  if (!variable) {
    if (doDebug) console.log('no variable', componentName);
    return false;
  }

  // Check import type
  if (
    variable.defs.length === 0 ||
    variable.defs[0].type !== 'ImportBinding' ||
    variable.defs[0].node.type !== AST_NODE_TYPES.ImportSpecifier
  ) {
    if (doDebug) console.log('no import', componentName);
    return false;
  }

  // Check import source
  const importSource =
    variable.defs[0].node.imported.type === AST_NODE_TYPES.Identifier
      ? variable.defs[0].node.imported.name
      : variable.defs[0].node.imported.value;
  if (libs.includes(importSource as unknown as GTLibrary)) {
    return false;
  }

  // Check name
  // TODO: handle aliases (eg resolve the component name)
  const resolvedComponentName = componentName;
  if (resolvedComponentName !== targetComponentName) {
    if (doDebug) console.log('not target component', componentName);
    return false;
  }
  if (doDebug) console.log('is target component', componentName);
  return true;
}

export function isTComponent({
  context,
  node,
  libs,
}: Omit<IsGTComponentOptions, 'targetComponentName'>): boolean {
  return isGTComponent({
    context,
    node,
    libs,
    targetComponentName: T_COMPONENT_NAME,
  });
}
