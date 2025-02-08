import _isSameDialect from './isSameDialect';
import _isSameLanguage from './isSameLanguage';
import { _isValidLocale, _standardizeLocale } from './isValidLocale';

/**
 * Given a target locale and a source locale, determines whether a translation is required
 * If the target locale and the source locale are the same, returns false, otherwise returns true
 * If a translation is not possible due to the target locale being outside of the optional approvedLanguages scope, also returns false
 * @internal
 */
export default function _requiresTranslation(
  sourceLocale: string,
  targetLocale: string,
  approvedLocales?: string[]
): boolean {
  // If codes are invalid
  if (
    !_isValidLocale(sourceLocale) ||
    !_isValidLocale(targetLocale) ||
    (approvedLocales &&
      approvedLocales.some((approvedLocale) => !_isValidLocale(approvedLocale)))
  )
    return false;

  // Check if the languages are identical, if so, a translation is not required
  if (_isSameDialect(sourceLocale, targetLocale)) return false;

  // Check that the target locale is within the approvedLocales scope, if not, a translation is not required
  // isSameLanguage rather than checkTwoLocalesAreSameDialect so we can show different dialects as a fallback
  if (
    approvedLocales &&
    !approvedLocales.some((approvedLocale) =>
      _isSameLanguage(targetLocale, approvedLocale)
    )
  )
    return false;

  // Otherwise, a translation is required!
  return true;
}
