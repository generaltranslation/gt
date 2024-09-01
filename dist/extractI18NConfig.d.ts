/**
 * Extracts projectID, defaultLocale, approvedLocales, and dictionaryName from an i18n.js file.
 * @param {string} filePath - The path to the i18n.js file.
 * @returns {object|null} - An object containing the extracted values or null if none found or incorrect types.
 */
export declare function extractI18nConfig(filePath: string): {
    projectID?: string;
    defaultLocale?: string;
    approvedLocales?: string[];
    dictionaryName?: string;
};
