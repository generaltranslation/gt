/**
 * Marks content as derivable by the GT compiler and CLI.
 *
 * Use `derive()` when a translation string or context needs content that is
 * computed from source code, but should still be discovered during extraction
 * instead of treated as a runtime interpolation variable. The CLI attempts to
 * resolve the derivable expression into every possible static value and
 * includes those values in the source content that gets translated.
 *
 * `derive()` returns its argument unchanged at runtime.
 *
 * Run `gt validate` after adding or changing `derive()` calls to verify that
 * each derivable expression can be resolved by the CLI before translating or
 * building.
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
 * @param {T extends string | boolean | number | null | undefined} content - Content to derive for translation extraction.
 * @returns {T} The same content, unchanged at runtime.
 */
export function derive<T extends string | boolean | number | null | undefined>(
  content: T
): T {
  return content;
}

/**
 * @deprecated Use derive() instead.
 *
 * Marks content as derivable by the GT compiler and CLI.
 *
 * Use `derive()` instead of `declareStatic()` for new code. This alias is kept
 * for backwards compatibility and returns its argument unchanged at runtime.
 *
 * Run `gt validate` after adding or changing derived content to verify that
 * each derivable expression can be resolved by the CLI before translating or
 * building.
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
 * @param {T extends string | boolean | number | null | undefined} content - Content to derive for translation extraction.
 * @returns {T} The same content, unchanged at runtime.
 */
export const declareStatic = derive;
