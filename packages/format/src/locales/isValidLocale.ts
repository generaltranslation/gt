import { intlCache } from '../cache/IntlCache';
import { libraryDefaultLocale } from '../settings/settings';
import { getCustomLocaleCode, type CustomMapping } from './customLocaleMapping';

const scriptExceptions = new Set([
  'Cham',
  'Jamo',
  'Kawi',
  'Lisu',
  'Toto',
  'Thai',
]);

// According to BCP 47, the range qaa-qtz is reserved for private-use language codes
const isCustomLanguage = (language: string) => {
  return language >= 'qaa' && language <= 'qtz';
};

// Both helpers are deterministic per locale string, and LocaleConfig runs
// them against every configured locale on each requiresTranslation and
// determineLocale call, so results are memoized by string. Bounded because
// locale strings can come from unbounded user input such as Accept-Language
// headers; clearing on overflow only costs a recompute.
const MAX_CACHE_SIZE = 1000;
const validityCache = new Map<string, boolean>();
const standardizeCache = new Map<string, string>();

/**
 * Checks if a given BCP 47 language code is valid.
 * @param {string} code - The BCP 47 language code to validate.
 * @param {CustomMapping} [customMapping] - The custom mapping to use for validation.
 * @returns {boolean} True if the BCP 47 code is valid, false otherwise.
 * @internal
 */
export const _isValidLocale = (
  locale: string,
  customMapping?: CustomMapping
): boolean => {
  // Use the canonical code from custom mappings when one is configured.
  locale = getCustomLocaleCode(customMapping, locale) || locale;
  const cached = validityCache.get(locale);
  if (cached !== undefined) return cached;
  const result = computeIsValidLocale(locale);
  if (validityCache.size >= MAX_CACHE_SIZE) validityCache.clear();
  validityCache.set(locale, result);
  return result;
};

const computeIsValidLocale = (locale: string): boolean => {
  try {
    const { language, region, script } = intlCache.get('Locale', locale);
    const partCount = 1 + Number(Boolean(region)) + Number(Boolean(script));
    if (locale.split('-').length !== partCount) return false;
    const displayLanguageNames = intlCache.get(
      'DisplayNames',
      [libraryDefaultLocale],
      {
        type: 'language',
      }
    );
    if (
      displayLanguageNames.of(language) === language &&
      !isCustomLanguage(language)
    )
      return false;
    if (region) {
      const displayRegionNames = intlCache.get(
        'DisplayNames',
        [libraryDefaultLocale],
        {
          type: 'region',
        }
      );
      if (displayRegionNames.of(region) === region) return false;
    }
    if (script) {
      const displayScriptNames = intlCache.get(
        'DisplayNames',
        [libraryDefaultLocale],
        {
          type: 'script',
        }
      );
      if (
        displayScriptNames.of(script) === script &&
        !scriptExceptions.has(script)
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
};

/**
 * Standardizes a BCP 47 locale to ensure correct formatting.
 * @param {string} locale - The BCP 47 locale to standardize.
 * @returns {string} The standardized BCP 47 locale, or the input string if it cannot be standardized.
 * @internal
 */
export const _standardizeLocale = (locale: string): string => {
  const cached = standardizeCache.get(locale);
  if (cached !== undefined) return cached;
  let result: string;
  try {
    result = Intl.getCanonicalLocales(locale)[0];
  } catch {
    result = locale;
  }
  if (standardizeCache.size >= MAX_CACHE_SIZE) standardizeCache.clear();
  standardizeCache.set(locale, result);
  return result;
};
