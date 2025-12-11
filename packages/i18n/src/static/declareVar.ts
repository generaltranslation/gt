import { VAR_NAME } from './constants';
import { sanitizeVar } from './sanitizeVar';

/**
 * Given an arbitrary string, sanitize it so it does not break the following ICU message syntax:
 * {_gt_, select, other {string_here}}
 * @param variable - The variable to sanitize.
 * @param options - The options for the sanitization.
 * @param options.$name - The name of the variable.
 * @returns The sanitized variable.
 */
export function declareVar(
  variable: string,
  options?: { $name?: string }
): string {
  // variable section
  const sanitizedVariable = sanitizeVar(variable);
  const variableSection = `, other {${sanitizedVariable}}`;

  // name section
  let nameSection = '';
  if (options?.$name) {
    const sanitizedName = sanitizeVar(options.$name);
    nameSection = ` ${VAR_NAME} {${sanitizedName}}`;
  }

  // interpolate
  return `{_gt_, select${variableSection}${nameSection}}`;
}
