/**
 * Error creation utilities for the GT Babel plugin
 */

/**
 * Generate warning message for dynamic content violations
 */
export function createDynamicContentWarning(
  filename?: string,
  componentName?: string
): string {
  if (filename) {
    return `gt-next in ${filename}: <${componentName}> component contains unwrapped dynamic content. Consider wrapping expressions in <Var>{expression}</Var> components for proper translation handling.`;
  } else {
    return `gt-next in : <${componentName}> component contains unwrapped dynamic content. Consider wrapping expressions in <Var>{expression}</Var> components for proper translation handling.`;
  }
}

/**
 * Generate warning message for dynamic function call violations
 */
export function createDynamicFunctionWarning(
  filename?: string,
  functionName?: string,
  violationType?: string
): string {
  if (filename) {
    return `gt-next in ${filename}: ${functionName}() function call uses ${violationType} which prevents proper translation key generation. Use string literals instead.`;
  } else {
    return `gt-next in : ${functionName}() function call uses ${violationType} which prevents proper translation key generation. Use string literals instead.`;
  }
}
