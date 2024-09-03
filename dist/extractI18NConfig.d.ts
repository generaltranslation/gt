/**
 * Extracts projectID, defaultLocale, approvedLocales, dictionaryName, and description from an i18n.js file.
 * @param {string} filePath - The path to the i18n.js file.
 * @returns {object|null} - An object containing the extracted values or null if none found or incorrect types.
 */
export declare function extractI18nConfig(filePath: string): {
    projectID?: string;
    defaultLanguage?: string;
    languages?: string[];
    dictionaryName?: string;
    description?: string;
};
