/**
 * Analysis utilities for identifying GT components and functions
 */

/**
 * Check if a component name matches known gt-next translation components
 */
export function isTranslationComponent(name: string): boolean {
  return name === 'T';
}

/**
 * Check if a component name matches known gt-next variable components
 */
export function isVariableComponent(name: string): boolean {
  return ['Var', 'Num', 'Currency', 'DateTime'].includes(name);
}

/**
 * Check if a name is a GT branch component
 */
export function isBranchComponent(name: string): boolean {
  return ['Branch', 'Plural'].includes(name);
}

/**
 * Check if a name is a GT translation function
 */
export function isTranslationFunction(name: string): boolean {
  return ['useGT', 'getGT'].includes(name);
}

/**
 * Check if it's a translation function callback (const t = useGT())
 */
export function isTranslationFunctionCallback(name: string): boolean {
  return ['useGT_callback', 'getGT_callback'].includes(name);
}