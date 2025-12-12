import { VAR_IDENTIFIER, VAR_NAME_IDENTIFIER } from './utils/constants';
import { sanitizeVar } from './sanitizeVar';

/**
 * Mark as a non-translatable string. Use within a declareStatic() call to mark content as not statically analyzable (e.g., not possible to know before runtime).
 * @param variable - The variable to sanitize.
 * @param options - The options for the sanitization.
 * @param options.$name - The name of the variable.
 * @returns The sanitized variable.
 *
 * @example
 * ```jsx
 *
 * function staticFunction() {
 *   if (condition) {
 *     return declareVar(Math.random())
 *   }
 *   return 'John Doe';
 * }
 *
 * const gt = useGT();
 * gt(`My name is ${declareStatic(staticFunction())}`);
 * ```
 */
export function declareVar(
  variable: string | number | boolean | null | undefined,
  options?: { $name?: string }
): string {
  // variable section
  const sanitizedVariable = sanitizeVar(String(variable ?? ''));
  const variableSection = ` other {${sanitizedVariable}}`;

  // name section
  let nameSection = '';
  if (options?.$name) {
    const sanitizedName = sanitizeVar(options.$name);
    nameSection = ` ${VAR_NAME_IDENTIFIER} {${sanitizedName}}`;
  }

  // interpolate
  return `{${VAR_IDENTIFIER}, select,${variableSection}${nameSection}}`;
}
