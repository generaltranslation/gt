import { intlCache } from '../cache/IntlCache';
import { libraryDefaultLocale } from '../settings/settings';
import { CustomMapping } from './customLocaleMapping';

const scriptExceptions = ['Cham', 'Jamo', 'Kawi', 'Lisu', 'Toto', 'Thai'];

// BCP 47 reserves the qaa–qtz range for private-use language codes.
const isCustomLanguage = (language: string) => {
  return language >= 'qaa' && language <= 'qtz';
};

/**
 * Checks whether a BCP 47 locale code is valid.
 * @param {string} locale - The BCP 47 locale code to validate.
 * @param {CustomMapping} [customMapping] - The custom mapping to use for validation.
 * @returns {boolean} True if the BCP 47 locale code is valid, false otherwise.
 * @internal
 */
export const _isValidLocale = (
  locale: string,
  customMapping?: CustomMapping
): boolean => {
  // Resolve custom aliases before validation.
  if (
    customMapping?.[locale] &&
    typeof customMapping[locale] === 'object' &&
    'code' in (customMapping[locale] as Object) &&
    (customMapping[locale] as { code: string }).code
  ) {
    locale = (customMapping[locale] as { code: string }).code;
  }

  try {
    const { language, region, script } = intlCache.get('Locale', locale);
    if (
      locale.split('-').length !==
      (() => {
        let partCount = 1;
        if (region) partCount += 1;
        if (script) partCount += 1;
        return partCount;
      })()
    )
      return false;
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
        !scriptExceptions.includes(script)
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
