/**
 * ICU format validation for static strings in gt()/msg() calls.
 *
 * Only validates strings that are fully static (no derive/declareStatic)
 * and use ICU format (the default, or explicit $format: "ICU").
 * Reports parse errors but does not auto-fix.
 */

import { parse } from '@formatjs/icu-messageformat-parser';

/**
 * Returns null if the string is valid ICU, or an error message if not.
 */
export function validateICU(str: string): string | null {
  try {
    parse(str);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
