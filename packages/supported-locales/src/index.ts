
import supportedLocales from "./supportedLocales";
import { getLocaleProperties, isValidLocale, standardizeLocale } from "generaltranslation";

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
    if (!isValidLocale(locale)) return null;
    locale = standardizeLocale(locale);

    // Check if the exact locale is directly supported
    if (supportedLocales[locale]) return locale;

    // Check if there's support for the general language code
    const { 
        languageCode, minimizedCode,
        regionCode, scriptCode
    } = getLocaleProperties(locale);
    if (supportedLocales[languageCode]) {
        const exactSupportedLocales = supportedLocales[languageCode];

        // If the full locale is supported under this language category
        if (exactSupportedLocales[locale]) return locale;

        // If a minimized variant of this locale is supported (e.g., "en" for "en-US")
        if (exactSupportedLocales[minimizedCode]) return minimizedCode;

        // Attempt to match parts
        const parts = locale.split('-');
        if (parts.length > 2) {
            const languageWithRegion = `${languageCode}-${regionCode}`;
            if (exactSupportedLocales[languageWithRegion]) return languageWithRegion;
            const languageWithScript = `${languageCode}-${scriptCode}`;
            if (exactSupportedLocales[languageWithScript]) return languageWithScript;
        }

        // No exact or minimized match; fallback to the language code
        return languageCode;
    }

    // No match found; return null
    return null;
}

/**
 * Generates a sorted list of supported locales.
 * @returns {string[]} A sorted array containing the supported base languages and their specific locales.
 */
export function listSupportedLocales(): string[] {
    const list = [];
    for (const [language, locales] of Object.entries(supportedLocales)) {
        list.push(language); // Add the base language
        list.push(...Object.keys(locales)); // Add each specific locale
    }
    return list.sort();
}