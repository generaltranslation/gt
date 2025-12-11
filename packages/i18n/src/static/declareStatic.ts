/**
 * Marks its input and upstream as statically analyzable at build time
 * @param content
 * @returns content
 */
export function declareStatic<
  T extends string | boolean | number | null | undefined,
>(content: T): T {
  return content;
}
