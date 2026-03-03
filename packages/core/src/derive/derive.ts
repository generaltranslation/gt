/**
 * derive() is a powerful but dangerous function which marks its argument as derivable (statically analyzable) for the compiler and CLI tool.
 *
 * This function is dangerous because it can cause the compiler and CLI tool to throw an error if the argument is not derivable.
 *
 * @example
 * ```jsx
 * function getSubject() {
 *   return (Math.random() > 0.5) ? "Alice" : "Brian";
 * }
 * ...
 * gt(`My name is ${derive(getSubject())}`);
 * ```
 *
 * @param {T extends string | boolean | number | null | undefined} content - Content to mark as derivable.
 * @returns content
 */
export function derive<T extends string | boolean | number | null | undefined>(
  content: T
): T {
  return content;
}

/**
 * @deprecated Use derive() instead.
 *
 * declareStatic() is a powerful but dangerous function which marks its argument as derivable (statically analyzable) for the compiler and CLI tool.
 *
 * This function is dangerous because it can cause the compiler and CLI tool to throw an error if the argument is not derivable.
 *
 * @example
 * ```jsx
 * function getSubject() {
 *   return (Math.random() > 0.5) ? "Alice" : "Brian";
 * }
 * ...
 * gt(`My name is ${declareStatic(getSubject())}`);
 * ```
 *
 * @param {T extends string | boolean | number | null | undefined} content - Content to mark as derivable.
 * @returns content
 */
export const declareStatic = derive;
