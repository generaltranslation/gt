import { CustomMapping } from './customLocaleMapping';
import _isSameDialect from './isSameDialect';
import _isSameLanguage from './isSameLanguage';
import { _isValidLocale } from './isValidLocale';

/**
 * Determines whether a translation is required between source and target locales.
 * Returns false when locales are invalid, the target is the same dialect as the source,
 * or the target is outside the optional approved locale scope.
 * @internal
 */
export default function _requiresTranslation(
  sourceLocale: string,
  targetLocale: string,
  approvedLocales?: string[],
  customMapping?: CustomMapping
): boolean {
  // Invalid locale codes cannot be translated.
  if (
    !_isValidLocale(sourceLocale, customMapping) ||
    !_isValidLocale(targetLocale, customMapping) ||
    (approvedLocales &&
      approvedLocales.some(
        (approvedLocale) => !_isValidLocale(approvedLocale, customMapping)
      ))
  ) {
    return false;
  }

  // Matching dialects do not require translation.
  if (_isSameDialect(sourceLocale, targetLocale)) {
    return false;
  }

  // Match approved locales by language so different dialects can be used as fallbacks.
  if (
    approvedLocales &&
    !approvedLocales.some((approvedLocale) =>
      _isSameLanguage(targetLocale, approvedLocale)
    )
  ) {
    return false;
  }
  return true;
}
