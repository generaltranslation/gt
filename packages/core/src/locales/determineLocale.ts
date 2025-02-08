import { _isValidLocale, _standardizeLocale } from './isValidLocale';
import _isSameLanguage from './isSameLanguage';
import _isSameDialect from './isSameDialect';
import _getLocaleProperties from './getLocaleProperties';

/**
 * Given a list of locales and a list of approved locales, sorted in preference order
 * Determines which locale is the best match among the approved locales, prioritizing exact matches and falling back to dialects of the same language
 * @internal
 */
export default function _determineLocale(
  locales: string | string[],
  approvedLocales: string[]
): string | undefined {
  if (typeof locales === 'string') locales = [locales];
  locales = locales.filter(_isValidLocale);
  approvedLocales = approvedLocales.filter(_isValidLocale);
  for (const locale of locales) {
    const candidates = approvedLocales.filter((approvedLocale) =>
      _isSameLanguage(locale, approvedLocale)
    );
    const getMatchingCode = ({
      locale,
      languageCode,
      minimizedCode,
      regionCode,
      scriptCode,
    }: {
      locale: string;
      languageCode: string;
      minimizedCode: string;
      regionCode: string;
      scriptCode: string;
    }) => {
      const locales = [
        locale, // If the full locale is supported under this language category
        `${languageCode}-${regionCode}`, // Attempt to match parts
        `${languageCode}-${scriptCode}`,
        minimizedCode, // If a minimized variant of this locale is supported
      ];
      for (const l of locales) {
        if (candidates.includes(l)) return l;
      }
      return null;
    };
    const { languageCode, ...codes } = _getLocaleProperties(locale);
    const matchingCode =
      getMatchingCode({ locale, languageCode, ...codes }) ||
      getMatchingCode({
        locale: languageCode,
        ..._getLocaleProperties(languageCode),
      });
    if (matchingCode) return matchingCode;
  }
  return undefined;
}
