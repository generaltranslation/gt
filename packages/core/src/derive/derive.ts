/**
 * derive() marks its argument as derivable, meaning statically analyzable by the compiler and CLI.
 *
 * This function can cause the compiler and CLI to throw an error if the argument is not actually derivable.
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
 * @returns The original content.
 */
export function derive<T extends string | boolean | number | null | undefined>(
  content: T
): T {
  return content;
}

/**
 * @deprecated Use derive() instead.
 *
 * declareStatic() marks its argument as derivable, meaning statically analyzable by the compiler and CLI.
 *
 * This function can cause the compiler and CLI to throw an error if the argument is not actually derivable.
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
 * @returns The original content.
 */
export const declareStatic = derive;
