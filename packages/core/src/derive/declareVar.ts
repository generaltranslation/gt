import { VAR_IDENTIFIER, VAR_NAME_IDENTIFIER } from './utils/constants';
import { sanitizeVar } from './utils/sanitizeVar';

/**
 * Marks content as a non-translatable variable. Use within a derive() call for
 * content that cannot be statically analyzed.
 *
 * @example
 * function nonDerivableFunction() {
 *   return Math.random();
 * }
 *
 * function derivableFunction() {
 *   if (condition) {
 *     return declareVar(nonDerivableFunction())
 *   }
 *   return 'John Doe';
 * }
 *
 * const gt = useGT();
 * gt(`My name is ${derive(derivableFunction())}`);
 *
 * @param {string | number | boolean | null | undefined} variable - The variable to sanitize.
 * @param {Object} [options] - The options for the sanitization.
 * @param {string} [options.$name] - The name of the variable.
 * @returns {string} The sanitized value.
 */
export function declareVar(
  variable: string | number | boolean | null | undefined,
  options?: { $name?: string }
): string {
  // Variable section.
  const sanitizedVariable = sanitizeVar(String(variable ?? ''));
  const variableSection = ` other {${sanitizedVariable}}`;

  // Name section.
  let nameSection = '';
  if (options?.$name) {
    const sanitizedName = sanitizeVar(options.$name);
    nameSection = ` ${VAR_NAME_IDENTIFIER} {${sanitizedName}}`;
  }

  // Interpolate into ICU select syntax.
  return `{${VAR_IDENTIFIER}, select,${variableSection}${nameSection}}`;
}
