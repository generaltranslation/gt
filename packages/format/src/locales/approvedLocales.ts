import { CustomMapping } from './customLocaleMapping';
import { _getLocaleLanguage } from './isSameLanguage';
import { _isValidLocale, _standardizeLocale } from './isValidLocale';

/**
 * An approved-locales list prepared once so requiresTranslation and
 * determineLocale do not revalidate, restandardize, and reindex the whole
 * list on every call.
 * @internal
 */
export type ApprovedLocales = {
  /** Whether every approved locale is valid. */
  allValid: boolean;
  /** Language subtags of the valid approved locales. */
  languages: Set<string>;
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
  let allValid = true;
  const languages = new Set<string>();
  const byLanguage = new Map<string, Set<string>>();
  for (const approvedLocale of approvedLocales) {
    if (!_isValidLocale(approvedLocale, customMapping)) {
      allValid = false;
      continue;
    }
    const language = _getLocaleLanguage(approvedLocale);
    if (language === undefined) continue;
    languages.add(language);
    let bucket = byLanguage.get(language);
    if (bucket === undefined) {
      bucket = new Set();
      byLanguage.set(language, bucket);
    }
    bucket.add(_standardizeLocale(approvedLocale));
  }
  return { allValid, languages, byLanguage };
}
