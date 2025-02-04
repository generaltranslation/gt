
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

    // Check if there's support for the general language code
    const { 
        languageCode, 
        minimizedCode, maximizedCode,
        regionCode, scriptCode
    } = getLocaleProperties(locale);
    if (supportedLocales[languageCode]) {
        const exactSupportedLocales = supportedLocales[languageCode];

        // If the full locale is supported under this language category
        if (exactSupportedLocales.includes(locale)) return locale;

        // If a minimized variant of this locale is supported
        if (exactSupportedLocales.includes(minimizedCode)) return minimizedCode;

        // If only the language code is supported
        if (exactSupportedLocales.includes(languageCode)) return languageCode;

        // Attempt to match parts
        const parts = maximizedCode.split('-');
        if (parts.length > 2) {
            const languageWithRegion = `${languageCode}-${regionCode}`;
            if (exactSupportedLocales.includes(languageWithRegion)) return languageWithRegion;
            const languageWithScript = `${languageCode}-${scriptCode}`;
            if (exactSupportedLocales.includes(languageWithScript)) return languageWithScript;
        }
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