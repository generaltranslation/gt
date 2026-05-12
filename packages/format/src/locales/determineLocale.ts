import { _isValidLocale, _standardizeLocale } from './isValidLocale';
import { _isSameLanguage } from './isSameLanguage';
import {
  _getLocaleProperties,
  type LocaleProperties,
} from './getLocaleProperties';
import { CustomMapping } from './customLocaleMapping';

function standardizeValidLocales(
  locales: string[],
  customMapping?: CustomMapping
) {
  return locales
    .filter((locale) => _isValidLocale(locale, customMapping))
    .map(_standardizeLocale);
}

function getMatchingCode(
  locale: string,
  { languageCode, minimizedCode, regionCode, scriptCode }: LocaleProperties,
  candidates: Set<string>
) {
  const localeCodes = [
    locale, // If the full locale is supported under this language category
    `${languageCode}-${regionCode}`, // Attempt to match parts
    `${languageCode}-${scriptCode}`,
    minimizedCode, // If a minimized variant of this locale is supported
  ];
  return localeCodes.find((localeCode) => candidates.has(localeCode));
}

/**
 * Given a list of locales and a list of approved locales, sorted in preference order
 * Determines which locale is the best match among the approved locales, prioritizing exact matches and falling back to dialects of the same language
 * @internal
 */
export function _determineLocale(
  locales: string | string[],
  approvedLocales: string[],
  customMapping?: CustomMapping
): string | undefined {
  locales = standardizeValidLocales(
    Array.isArray(locales) ? locales : [locales],
    customMapping
  );
  approvedLocales = standardizeValidLocales(approvedLocales, customMapping);
  for (const locale of locales) {
    const candidates = new Set(
      approvedLocales.filter((approvedLocale) =>
        _isSameLanguage(locale, approvedLocale)
      )
    );
    const properties = _getLocaleProperties(locale);
    const matchingCode =
      getMatchingCode(locale, properties, candidates) ||
      getMatchingCode(
        properties.languageCode,
        _getLocaleProperties(properties.languageCode),
        candidates
      );
    if (matchingCode) return matchingCode;
  }
  return undefined;
}
