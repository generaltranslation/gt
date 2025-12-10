/**
 * Given an arbitrary string, sanitize it so it does not break the following ICU message syntax:
 * {_gt_, select, other {string_here}}
 * @param variable - The variable to sanitize.
 * @param options - The options for the sanitization.
 * @param options.$name - The name of the variable.
 * @returns The sanitized variable.
 */
export function sanitizeVar(
  variable: string,
  options?: { $name?: string }
): string {
  // variable section
  const sanitizedVariable = sanitizeString(variable);
  const variableSection = `, other {${sanitizedVariable}}`;

  // name section
  let nameSection = '';
  if (options?.$name) {
    const sanitizedName = sanitizeString(options.$name);
    nameSection = ` _gt_var_name_ {${sanitizedName}}`;
  }

  // interpolate
  return `{_gt_, select${variableSection}${nameSection}}`;
}

/**
 * Sanitize arbitrary string so it does not break the following ICU message syntax:
 * {_gt_, select, other {string_here}}
 *
 * Escapes ICU special characters by:
 * 1. Doubling all single quotes (U+0027 ' and U+2019 ')
 * 2. Adding a single quote before the first special character ({}<>)
 * 3. Adding a single quote after the last special character ({}<>)
 *
 * Note: # is not treated as universally special since it only has meaning
 * in specific ICU contexts (like plural expressions).
 */
function sanitizeString(string: string): string {
  // First, double all single quotes (both ASCII and Unicode)
  let result = string.replace(/['\']/g, "''");

  // Find first and last positions of special characters
  const specialChars = /[{}<>]/;
  const firstSpecialIndex = result.search(specialChars);

  if (firstSpecialIndex === -1) {
    // No special characters, return with just doubled quotes
    return result;
  }

  // Find last special character position
  let lastSpecialIndex = -1;
  for (let i = result.length - 1; i >= 0; i--) {
    if (specialChars.test(result[i])) {
      lastSpecialIndex = i;
      break;
    }
  }

  // Insert quotes around the special character region
  result =
    result.slice(0, firstSpecialIndex) +
    "'" +
    result.slice(firstSpecialIndex, lastSpecialIndex + 1) +
    "'" +
    result.slice(lastSpecialIndex + 1);

  return result;
}
