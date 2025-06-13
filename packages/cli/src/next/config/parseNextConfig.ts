import fs from 'node:fs';
import GT from 'generaltranslation';
import path from 'node:path';

/**
 * Extracts projectId, defaultLocale, and locales from a next.config.js file.
 * @param {string} filePath - The path to the next.config.js file.
 * @returns {object|null} - An object containing the extracted values or null if none found or incorrect types.
 */
export async function parseNextConfig(filePath: string): Promise<{
  projectId?: string;
  defaultLocale?: string;
  locales?: string[];
}> {
  // Resolve the absolute path
  const absoluteFilePath = path.resolve(filePath);

  // Check if the file exists
  if (!fs.existsSync(absoluteFilePath)) {
    return {};
  }

  // Read the file content
  const fileContent = await fs.promises.readFile(absoluteFilePath, 'utf8');

  // Regular expressions to extract the values
  const defaultLocaleRegex = /defaultLocale:\s*['"]([^'"]+)['"]/;
  const projectIdRegex = /projectId:\s*['"]([^'"]+)['"]/;
  const localesRegex = /locales:\s*\[([^\]]+)\]/;

  // Extract the values
  const defaultLocaleMatch = fileContent.match(defaultLocaleRegex);
  const projectIdMatch = fileContent.match(projectIdRegex);
  const localesMatch = fileContent.match(localesRegex);

  const defaultLocale =
    defaultLocaleMatch && typeof defaultLocaleMatch[1] === 'string'
      ? defaultLocaleMatch[1]
      : undefined;
  const projectId =
    projectIdMatch && typeof projectIdMatch[1] === 'string'
      ? projectIdMatch[1]
      : undefined;
  const locales = localesMatch
    ? localesMatch[1]
        .split(',')
        .map((locale) => locale.trim().replace(/['"]/g, ''))
        .filter((locale) => typeof locale === 'string')
    : undefined;

  // Ensure approvedLocales is an array of strings
  const validLocales =
    locales && locales.every((locale) => GT.isValidLocale(locale))
      ? locales
      : undefined;

  // Return the extracted values if they pass type checks or return null
  if (defaultLocale || projectId || validLocales) {
    return {
      ...(defaultLocale && { defaultLocale }),
      ...(projectId && { projectId }),
      ...(validLocales && { locales: validLocales }),
    };
  } else {
    return {};
  }
}
