/**
 * Analysis utilities for identifying GT components and functions
 */

import { GT_ALL_FUNCTIONS, GT_CALLBACK_FUNCTIONS, GT_COMPONENT_TYPES, GT_FUNCTIONS } from "../constants";

/**
 * Check if a name is a GT function
 * @param name - The name to check
 * @returns True if the name is a GT function
 */
export function isGTFunction(name: string): name is GT_ALL_FUNCTIONS {
  return Object.values(GT_FUNCTIONS).includes(name as GT_FUNCTIONS);
}

/**
 * Check if a component name matches known gt-next translation components
 */
export function isTranslationComponent(name: string): name is GT_COMPONENT_TYPES.T {
  return name === GT_COMPONENT_TYPES.T;
}

/**
 * Check if a component name matches known gt-next variable components
 */
export function isVariableComponent(name: string): name is GT_COMPONENT_TYPES {
  return ([GT_COMPONENT_TYPES.Var, GT_COMPONENT_TYPES.Num, GT_COMPONENT_TYPES.Currency, GT_COMPONENT_TYPES.DateTime] as string[]).includes(name);
}

/**
 * Check if a name is a GT branch component
 */
export function isBranchComponent(name: string): name is GT_COMPONENT_TYPES {
  return ([GT_COMPONENT_TYPES.Branch, GT_COMPONENT_TYPES.Plural] as string[]).includes(name);
}

/**
 * Check if a name is a GT translation function
 */
export function isTranslationFunction(name: string): name is GT_FUNCTIONS.useGT | GT_FUNCTIONS.getGT {
  return ([GT_FUNCTIONS.useGT, GT_FUNCTIONS.getGT] as string[]).includes(name);
}

/**
 * Check if it's a translation function callback (const t = useGT())
 */
export function isTranslationFunctionCallback(name: string): name is GT_CALLBACK_FUNCTIONS.useGT_callback | GT_CALLBACK_FUNCTIONS.getGT_callback {
  return ([GT_CALLBACK_FUNCTIONS.useGT_callback, GT_CALLBACK_FUNCTIONS.getGT_callback] as string[]).includes(name);
}

/**
 * Check if it's a special Jsx function
 */
export function isJsxFunction(name: string): boolean {
  return ['jsxDEV', 'jsx', 'jsxs', 'React.createElement'].includes(name);
}
