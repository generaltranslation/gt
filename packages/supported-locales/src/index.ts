import supportedLocales from './supportedLocales';
import {
  getLocaleProperties,
  isValidLocale,
  standardizeLocale,
} from 'generaltranslation';

const listedLocales: ReadonlySet<string> = new Set(listSupportedLocales());

// Intl rewrites some listed legacy tags (`cnr` to `sr-ME`). A request in the
// rewritten form resolves to the listed tag, unless that form is listed too
// (`tl` to `fil`).
const listedByCanonical = new Map(
  listSupportedLocales().flatMap((locale) => {
    const canonical = standardizeLocale(locale);
    return canonical === locale || listedLocales.has(canonical)
      ? []
      : [[canonical, locale] as const];
  })
);

// Tags listed by earlier releases under an invalid spelling.
const renamedLocales: ReadonlyMap<string, string> = new Map([
  ['el-EL', 'el-GR'],
]);

function findListedLocale(locale: string): string | undefined {
  return listedLocales.has(locale) ? locale : listedByCanonical.get(locale);
}

/**
 * @function getSupportedLocale
 * @description
 * Takes an arbitrary locale string, validates and standardizes it, and then attempts to map it
 * to a supported locale code based on a predefined list of locales. A listed locale, or the
 * standardized form of a listed legacy tag such as `sr-ME` for `cnr`, returns the listed code.
 * Otherwise, it attempts to find a compatible fallback by:
 *   1. Checking if the language portion is supported.
 *   2. Checking if a minimized form (e.g. "en" for "en-US") is supported.
 * If no supported match is found, it returns null.
 *
 * @param {string} locale - The locale string to check (e.g., "en-Latn-US").
 * @returns {string | null} A valid supported locale code if matched, otherwise null.
 */
export function getSupportedLocale(locale: string): string | null {
  locale = renamedLocales.get(locale) ?? locale;
  if (listedLocales.has(locale)) return locale;

  // Validate and standardize
  if (!isValidLocale(locale)) return null;
  locale = standardizeLocale(locale);

  // Check if there's support for the general language code
  const { languageCode, ...codes } = getLocaleProperties(locale);

  if (supportedLocales[languageCode]?.length) {
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
        const listed = findListedLocale(l);
        if (listed) return listed;
      }
      return null;
    };

    const matchingCode =
      getMatchingCode({ locale, languageCode, ...codes }) ||
      getMatchingCode({
        locale: languageCode,
        ...getLocaleProperties(languageCode),
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
