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

/**
 * Checks whether Intl.DisplayNames has CLDR data available by testing a
 * known-good code. Some browsers (embedded WebViews, privacy-focused
 * browsers, stripped ICU builds) support the DisplayNames API but lack
 * the underlying locale data, causing .of() to return the raw code
 * instead of a human-readable name (due to the default fallback: "code").
 */
const _hasDisplayNamesData = (): boolean => {
  try {
    const dn = intlCache.get('DisplayNames', [libraryDefaultLocale], {
      type: 'language',
    });
    // "en" should always resolve to "English" (or a localized equivalent)
    // when CLDR data is present. If it returns "en", data is missing.
    return dn.of('en') !== 'en';
  } catch {
    return false;
  }
};

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

  try {
    const { language, region, script } = intlCache.get('Locale', locale);
    const partCount = 1 + Number(Boolean(region)) + Number(Boolean(script));
    if (locale.split('-').length !== partCount) return false;

    // If the runtime lacks CLDR data for Intl.DisplayNames, skip the
    // display-name validation and rely solely on Intl.Locale parsing +
    // the part-count check above. This prevents false negatives on
    // browsers/WebViews with incomplete ICU data.
    if (!_hasDisplayNamesData()) return true;

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
  try {
    return Intl.getCanonicalLocales(locale)[0];
  } catch {
    return locale;
  }
};
