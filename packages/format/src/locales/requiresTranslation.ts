import {
  _prepareApprovedLocales,
  type ApprovedLocales,
} from './approvedLocales';
import { CustomMapping } from './customLocaleMapping';
import { _isSameDialect } from './isSameDialect';
import { _getLocaleLanguage } from './isSameLanguage';
import { _isValidLocale } from './isValidLocale';

/**
 * Same contract as _requiresTranslation, with the approved-locales work
 * hoisted into a prepared scope. An undefined scope means no approved-locales
 * restriction.
 * @internal
 */
export function _requiresTranslationWithScope(
  sourceLocale: string,
  targetLocale: string,
  approvedScope: ApprovedLocales | undefined,
  customMapping?: CustomMapping
): boolean {
  // If codes are invalid
  if (
    (approvedScope && !approvedScope.allValid) ||
    !_isValidLocale(sourceLocale, customMapping) ||
    !_isValidLocale(targetLocale, customMapping)
  ) {
    return false;
  }

  // Check if the languages are identical, if so, a translation is not required
  if (_isSameDialect(sourceLocale, targetLocale)) {
    return false;
  }

  // Check that the target locale is within the approvedLocales scope, if not, a translation is not required
  // Language-level rather than dialect-level membership so we can show different dialects as a fallback
  if (!approvedScope) return true;
  const targetLanguage = _getLocaleLanguage(targetLocale);
  return (
    targetLanguage !== undefined && approvedScope.languages.has(targetLanguage)
  );
}

/**
 * Given a target locale and a source locale, determines whether a translation is required
 * If the target locale and the source locale are the same, returns false, otherwise returns true
 * If a translation is not possible due to the target locale being outside of the optional approvedLanguages scope, also returns false
 * @internal
 */
export function _requiresTranslation(
  sourceLocale: string,
  targetLocale: string,
  approvedLocales?: string[],
  customMapping?: CustomMapping
): boolean {
  return _requiresTranslationWithScope(
    sourceLocale,
    targetLocale,
    approvedLocales
      ? _prepareApprovedLocales(approvedLocales, customMapping)
      : undefined,
    customMapping
  );
}
