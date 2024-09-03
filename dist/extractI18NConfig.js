"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractI18nConfig = extractI18nConfig;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Extracts projectID, defaultLocale, approvedLocales, dictionaryName, and description from an i18n.js file.
 * @param {string} filePath - The path to the i18n.js file.
 * @returns {object|null} - An object containing the extracted values or null if none found or incorrect types.
 */
function extractI18nConfig(filePath) {
    // Resolve the absolute path
    const absoluteFilePath = path_1.default.resolve(filePath);
    // Check if the file exists
    if (!fs_1.default.existsSync(absoluteFilePath)) {
        return {};
    }
    // Read the file content
    const fileContent = fs_1.default.readFileSync(absoluteFilePath, 'utf8');
    // Regular expressions to extract the values
    const defaultLocaleRegex = /defaultLocale:\s*['"]([^'"]+)['"]/;
    const dictionaryNameRegex = /dictionaryName:\s*['"]([^'"]+)['"]/;
    const projectIDRegex = /projectID:\s*['"]([^'"]+)['"]/;
    const approvedLocalesRegex = /approvedLocales:\s*\[([^\]]+)\]/;
    const descriptionRegex = /description:\s*['"]([^'"]+)['"]/;
    // Extract the values
    const defaultLocaleMatch = fileContent.match(defaultLocaleRegex);
    const dictionaryNameMatch = fileContent.match(dictionaryNameRegex);
    const projectIDMatch = fileContent.match(projectIDRegex);
    const approvedLocalesMatch = fileContent.match(approvedLocalesRegex);
    const descriptionMatch = fileContent.match(descriptionRegex);
    const defaultLocale = defaultLocaleMatch && typeof defaultLocaleMatch[1] === 'string' ? defaultLocaleMatch[1] : undefined;
    const dictionaryName = dictionaryNameMatch && typeof dictionaryNameMatch[1] === 'string' ? dictionaryNameMatch[1] : undefined;
    const projectID = projectIDMatch && typeof projectIDMatch[1] === 'string' ? projectIDMatch[1] : undefined;
    const approvedLocales = approvedLocalesMatch
        ? approvedLocalesMatch[1]
            .split(',')
            .map(locale => locale.trim().replace(/['"]/g, ''))
            .filter(locale => typeof locale === 'string')
        : undefined;
    const description = descriptionMatch && typeof descriptionMatch[1] === 'string' ? descriptionMatch[1] : undefined;
    // Ensure approvedLocales is an array of strings
    const validApprovedLocales = approvedLocales && approvedLocales.every(locale => typeof locale === 'string') ? approvedLocales : undefined;
    // Return the extracted values if they pass type checks or return null
    if (defaultLocale || dictionaryName || projectID || validApprovedLocales || description) {
        return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (defaultLocale && { defaultLanguage: defaultLocale })), (dictionaryName && { dictionaryName })), (projectID && { projectID })), (validApprovedLocales && { languages: validApprovedLocales })), (description && { description }));
    }
    else {
        return {};
    }
}
