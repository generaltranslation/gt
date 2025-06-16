import supportedLocales from './supportedLocales';
import { GT } from 'generaltranslation';

/**
 * @function getSupportedLocale
 * @description
 * Takes an arbitrary locale string, validates and standardizes it, and then attempts to map it
 * to a supported locale code based on a predefined list of locales. If the exact locale is supported,
 * it returns that locale directly. Otherwise, it attempts to find a compatible fallback by:
 *   1. Checking if the language portion is supported.
 *   2. Checking if a minimized form (e.g. "en" for "en-US") is supported.
 * If no supported match is found, it returns null.
 *
 * @param {string} locale - The locale string to check (e.g., "en-Latn-US").
 * @returns {string | null} A valid supported locale code if matched, otherwise null.
 */
export function getSupportedLocale(locale: string): string | null {
  // Validate and standardize
  if (!GT.isValidLocale(locale)) return null;
  locale = GT.standardizeLocale(locale);

  // Check if there's support for the general language code
  const { languageCode, ...codes } = GT.getLocaleProperties(locale);

  if (supportedLocales[languageCode]?.length) {
    const exactSupportedLocales = supportedLocales[languageCode];

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
        if (exactSupportedLocales.includes(l)) return l;
      }
      return null;
    };

    const matchingCode =
      getMatchingCode({ locale, languageCode, ...codes }) ||
      getMatchingCode({
        locale: languageCode,
        ...GT.getLocaleProperties(languageCode),
      });
    return matchingCode;
  }

  // No match found; return null
  return null;
}

/**
 * Generates a sorted list of supported locales.
 * @returns {string[]} A sorted array containing the supported base languages and their specific locales.
 */
export function listSupportedLocales(): string[] {
  const list: string[] = [];
  for (const localeList of Object.values(supportedLocales)) {
    list.push(...localeList); // Add each locale in the list
  }
  return list.sort();
}
