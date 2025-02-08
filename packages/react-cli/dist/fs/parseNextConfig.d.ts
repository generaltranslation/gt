/**
 * Extracts projectId, defaultLocale, and locales from a next.config.js file.
 * @param {string} filePath - The path to the next.config.js file.
 * @returns {object|null} - An object containing the extracted values or null if none found or incorrect types.
 */
export declare function parseNextConfig(filePath: string): {
  projectId?: string;
  defaultLocale?: string;
  locales?: string[];
};
