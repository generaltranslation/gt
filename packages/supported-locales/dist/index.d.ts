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
declare function getSupportedLocale(locale: string): string | null;
/**
 * Generates a sorted list of supported locales.
 * @returns {string[]} A sorted array containing the supported base languages and their specific locales.
 */
declare function listSupportedLocales(): string[];

export { getSupportedLocale, listSupportedLocales };
