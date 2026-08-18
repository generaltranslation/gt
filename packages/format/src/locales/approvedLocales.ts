import { CustomMapping } from './customLocaleMapping';
import { _getLocaleLanguage } from './isSameLanguage';
import { _isValidLocale, _standardizeLocale } from './isValidLocale';

/**
 * An approved-locales list prepared once so determineLocale does not
 * revalidate, restandardize, and reindex the whole list on every call.
 * @internal
 */
export type ApprovedLocales = {
  /** Standardized valid approved codes, bucketed by language subtag. */
  byLanguage: Map<string, Set<string>>;
};

/**
 * Validates, standardizes, and indexes an approved-locales list in a single
 * pass.
 * @internal
 */
export function _prepareApprovedLocales(
  approvedLocales: string[],
  customMapping?: CustomMapping
): ApprovedLocales {
  const byLanguage = new Map<string, Set<string>>();
  for (const approvedLocale of approvedLocales) {
    if (!_isValidLocale(approvedLocale, customMapping)) {
      continue;
    }
    const language = _getLocaleLanguage(approvedLocale);
    if (language === undefined) continue;
    let bucket = byLanguage.get(language);
    if (bucket === undefined) {
      bucket = new Set();
      byLanguage.set(language, bucket);
    }
    bucket.add(_standardizeLocale(approvedLocale));
  }
  return { byLanguage };
}
