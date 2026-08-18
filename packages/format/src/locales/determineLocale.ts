import {
  _prepareApprovedLocales,
  type ApprovedLocales,
} from './approvedLocales';
import { intlCache } from '../cache/IntlCache';
import { CustomMapping } from './customLocaleMapping';
import { _getLocaleLanguage } from './isSameLanguage';
import { _isValidLocale, _standardizeLocale } from './isValidLocale';

type LocaleMatchCodes = {
  languageCode: string;
  regionCode: string;
  scriptCode: string;
  minimizedCode: string;
};

/**
 * Derives the subtag codes used for matching. Mirrors how
 * _getLocaleProperties derives languageCode, regionCode, scriptCode, and
 * minimizedCode without a custom mapping, but skips the display-name and
 * emoji lookups that matching never reads.
 */
function getLocaleMatchCodes(locale: string): LocaleMatchCodes {
  try {
    const localeObject = intlCache.get('Locale', locale);
    const languageCode = localeObject.language;
    let regionCode = localeObject.region || '';
    let scriptCode = localeObject.script || '';
    if (!regionCode || !scriptCode) {
      const maximizedLocale = localeObject.maximize();
      regionCode ||= maximizedLocale.region || '';
      scriptCode ||= maximizedLocale.script || '';
    }
    return {
      languageCode,
      regionCode,
      scriptCode,
      minimizedCode: localeObject.minimize().toString(),
    };
  } catch {
    const code = _isValidLocale(locale) ? _standardizeLocale(locale) : locale;
    const codeParts = code.split('-');
    return {
      languageCode: codeParts[0] || code,
      regionCode: codeParts.length > 2 ? codeParts[2] : codeParts[1] || '',
      scriptCode: codeParts[3] || '',
      minimizedCode: code,
    };
  }
}

function findMatchingCode(
  locale: string,
  candidates: Set<string>
): string | undefined {
  // Preference order: the full locale, then partial and minimized variants.
  // The exact match needs no derived codes, so check it first.
  if (candidates.has(locale)) return locale;
  const { languageCode, regionCode, scriptCode, minimizedCode } =
    getLocaleMatchCodes(locale);
  const languageRegionCode = `${languageCode}-${regionCode}`;
  if (candidates.has(languageRegionCode)) return languageRegionCode;
  const languageScriptCode = `${languageCode}-${scriptCode}`;
  if (candidates.has(languageScriptCode)) return languageScriptCode;
  if (candidates.has(minimizedCode)) return minimizedCode;
  return undefined;
}

/**
 * Same contract as _determineLocale, with the approved-locales work hoisted
 * into a prepared index.
 * @internal
 */
export function _determineLocaleWithIndex(
  locales: string | string[],
  approvedIndex: ApprovedLocales,
  customMapping?: CustomMapping
): string | undefined {
  const candidateLocales = Array.isArray(locales) ? locales : [locales];
  for (const candidateLocale of candidateLocales) {
    if (!_isValidLocale(candidateLocale, customMapping)) continue;
    const locale = _standardizeLocale(candidateLocale);
    const language = _getLocaleLanguage(locale);
    if (language === undefined) continue;
    // Only approved locales of the same language can match.
    const candidates = approvedIndex.byLanguage.get(language);
    if (candidates === undefined) continue;
    const matchingCode =
      findMatchingCode(locale, candidates) ||
      // Fall back to matching through the bare language code, whose derived
      // codes carry the language's most likely region and script.
      findMatchingCode(language, candidates);
    if (matchingCode) return matchingCode;
  }
  return undefined;
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
  return _determineLocaleWithIndex(
    locales,
    _prepareApprovedLocales(approvedLocales, customMapping),
    customMapping
  );
}
