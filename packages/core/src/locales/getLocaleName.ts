import { libraryDefaultLocale } from "../internal";

/**
 * Retrieves the display name(s) of language code(s) using Intl.DisplayNames.
 *
 * @param {string} code - A language code.
 * @param {string} [defaultLanguage=libraryDefaultLanguage] - The language for display names.
 * @returns {string} The display name(s) corresponding to the code(s), or empty string(s) if invalid.
 * @internal
*/
export function _getLocaleName(code: string, defaultLanguage: string = libraryDefaultLocale): string {
    try {
        const displayNames = new Intl.DisplayNames([defaultLanguage, libraryDefaultLocale], { type: 'language' });
        return displayNames.of(code) || '';
    } catch {
        // In case Intl.DisplayNames construction fails, return empty string(s)
        return '';
    }
}