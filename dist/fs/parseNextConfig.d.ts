/**
 * Extracts projectID, defaultLocale, approvedLocales, and description from an i18n.js file.
 * @param {string} filePath - The path to the i18n.js file.
 * @returns {object|null} - An object containing the extracted values or null if none found or incorrect types.
 */
export declare function parseNextConfig(filePath: string): {
    projectID?: string;
    defaultLocale?: string;
    locales?: string[];
    description?: string;
};
