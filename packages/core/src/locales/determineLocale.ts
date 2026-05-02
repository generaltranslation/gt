import { _isValidLocale, _standardizeLocale } from './isValidLocale';
import _isSameLanguage from './isSameLanguage';
import _isSameDialect from './isSameDialect';
import _getLocaleProperties from './getLocaleProperties';
import { CustomMapping } from './customLocaleMapping';

/**
 * Determines the best approved locale match for a preference-ordered locale list.
 * Prioritizes exact matches and falls back to dialects of the same language.
 * @internal
 */
export default function _determineLocale(
  locales: string | string[],
  approvedLocales: string[],
  customMapping?: CustomMapping
): string | undefined {
  if (typeof locales === 'string') locales = [locales];
  locales = locales
    .filter((locale) => _isValidLocale(locale, customMapping))
    .map(_standardizeLocale);
  approvedLocales = approvedLocales
    .filter((locale) => _isValidLocale(locale, customMapping))
    .map(_standardizeLocale);
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
        locale, // Full locale match.
        `${languageCode}-${regionCode}`, // Language-region match.
        `${languageCode}-${scriptCode}`, // Language-script match.
        minimizedCode, // Minimized locale match.
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
