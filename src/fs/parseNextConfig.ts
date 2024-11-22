import fs from 'fs';
import { isValidLocale } from 'generaltranslation';
import path from 'path';

/**
 * Extracts projectID, defaultLocale, approvedLocales, and description from an i18n.js file.
 * @param {string} filePath - The path to the i18n.js file.
 * @returns {object|null} - An object containing the extracted values or null if none found or incorrect types.
 */
export function parseNextConfig(filePath: string): {
    projectID?: string,
    defaultLocale?: string,
    locales?: string[],
    description?: string
} {
    // Resolve the absolute path
    const absoluteFilePath = path.resolve(filePath);

    // Check if the file exists
    if (!fs.existsSync(absoluteFilePath)) {
        return {};
    }

    // Read the file content
    const fileContent = fs.readFileSync(absoluteFilePath, 'utf8');

    // Regular expressions to extract the values
    const defaultLocaleRegex = /defaultLocale:\s*['"]([^'"]+)['"]/;
    const projectIDRegex = /projectID:\s*['"]([^'"]+)['"]/;
    const localesRegex = /locales:\s*\[([^\]]+)\]/;
    const descriptionRegex = /description:\s*['"]([^'"]+)['"]/;

    // Extract the values
    const defaultLocaleMatch = fileContent.match(defaultLocaleRegex);
    const projectIDMatch = fileContent.match(projectIDRegex);
    const localesMatch = fileContent.match(localesRegex);
    const descriptionMatch = fileContent.match(descriptionRegex);

    const defaultLocale = defaultLocaleMatch && typeof defaultLocaleMatch[1] === 'string' ? defaultLocaleMatch[1] : undefined;
    const projectID = projectIDMatch && typeof projectIDMatch[1] === 'string' ? projectIDMatch[1] : undefined;
    const locales = localesMatch
        ? localesMatch[1]
            .split(',')
            .map(locale => locale.trim().replace(/['"]/g, ''))
            .filter(locale => typeof locale === 'string')
        : undefined;
    const description = descriptionMatch && typeof descriptionMatch[1] === 'string' ? descriptionMatch[1] : undefined;

    // Ensure approvedLocales is an array of strings
    const validLocales = locales && locales.every(locale => isValidLocale(locale)) ? locales : undefined;

    // Return the extracted values if they pass type checks or return null
    if (defaultLocale || projectID || validLocales || description) {
        return {
            ...(defaultLocale && { defaultLocale }),
            ...(projectID && { projectID }),
            ...(validLocales && { locales: validLocales }),
            ...(description && { description })
        };
    } else {
        return {};
    }
}
