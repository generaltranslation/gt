import { libraryDefaultLocale } from 'generaltranslation/internal';
import { IntlMessageFormat } from 'intl-messageformat';

/**
 * Given a sanitized ICU string
 * sanitizeVar('{_gt_, select, other {string_here}}') => 'string_here'
 * @param sanitizedVar - The sanitized ICU string.
 * @returns The desanitized variable.
 * @deprecated moving this to declareVars()
 */
export function decodeVar(sanitizedVar: string): string {
  return (
    new IntlMessageFormat(sanitizedVar, libraryDefaultLocale)
      .format({
        _gt_: 'other',
      })
      ?.toString() ?? ''
  );
}
