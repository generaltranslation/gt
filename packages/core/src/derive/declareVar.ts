import { RESERVED_NAME_PREFIX } from '@generaltranslation/icu/internal';
import { sanitizeVar } from './utils/sanitizeVar';

const VAR_NAME_IDENTIFIER = '_gt_var_name';

/**
 * The ICU text of a value known only at runtime inside derivable content:
 * `{_gt_, select, other {value}}`, with the name as a second branch.
 *
 * @param variable - The value to encode.
 * @param options.$name - The name of the variable.
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

  // interpolate
  return `{${RESERVED_NAME_PREFIX}, select,${variableSection}${nameSection}}`;
}
