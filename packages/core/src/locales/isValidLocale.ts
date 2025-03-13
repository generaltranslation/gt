import { intlCache } from 'src/cache/IntlCache';
import { libraryDefaultLocale } from '../internal';

const scriptExceptions = ['Cham', 'Jamo', 'Kawi', 'Lisu', 'Toto', 'Thai'];

/**
 * Checks if a given BCP 47 language code is valid.
 * @param {string} code - The BCP 47 language code to validate.
 * @returns {boolean} True if the BCP 47 code is valid, false otherwise.
 * @internal
 */
export const _isValidLocale = (locale: string): boolean => {
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
    if (displayLanguageNames.of(language) === language) return false;
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
 * @returns {string} The standardized BCP 47 locale, or an empty string if invalid.
 * @internal
 */
export const _standardizeLocale = (locale: string): string => {
  try {
    return Intl.getCanonicalLocales(locale)[0];
  } catch {
    return locale;
  }
};
