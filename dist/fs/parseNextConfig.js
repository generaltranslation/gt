"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseNextConfig = parseNextConfig;
const fs_1 = __importDefault(require("fs"));
const generaltranslation_1 = require("generaltranslation");
const path_1 = __importDefault(require("path"));
/**
 * Extracts projectID, defaultLocale, approvedLocales, dictionaryName, and description from an i18n.js file.
 * @param {string} filePath - The path to the i18n.js file.
 * @returns {object|null} - An object containing the extracted values or null if none found or incorrect types.
 */
function parseNextConfig(filePath) {
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
    const localesRegex = /locales:\s*\[([^\]]+)\]/;
    const descriptionRegex = /description:\s*['"]([^'"]+)['"]/;
    // Extract the values
    const defaultLocaleMatch = fileContent.match(defaultLocaleRegex);
    const dictionaryNameMatch = fileContent.match(dictionaryNameRegex);
    const projectIDMatch = fileContent.match(projectIDRegex);
    const localesMatch = fileContent.match(localesRegex);
    const descriptionMatch = fileContent.match(descriptionRegex);
    const defaultLocale = defaultLocaleMatch && typeof defaultLocaleMatch[1] === 'string' ? defaultLocaleMatch[1] : undefined;
    const dictionaryName = dictionaryNameMatch && typeof dictionaryNameMatch[1] === 'string' ? dictionaryNameMatch[1] : undefined;
    const projectID = projectIDMatch && typeof projectIDMatch[1] === 'string' ? projectIDMatch[1] : undefined;
    const locales = localesMatch
        ? localesMatch[1]
            .split(',')
            .map(locale => locale.trim().replace(/['"]/g, ''))
            .filter(locale => typeof locale === 'string')
        : undefined;
    const description = descriptionMatch && typeof descriptionMatch[1] === 'string' ? descriptionMatch[1] : undefined;
    // Ensure approvedLocales is an array of strings
    const validLocales = locales && locales.every(locale => (0, generaltranslation_1.isValidLanguageCode)(locale)) ? locales : undefined;
    // Return the extracted values if they pass type checks or return null
    if (defaultLocale || dictionaryName || projectID || validLocales || description) {
        return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (defaultLocale && { defaultLocale })), (dictionaryName && { dictionaryName })), (projectID && { projectID })), (validLocales && { locales: validLocales })), (description && { description }));
    }
    else {
        return {};
    }
}
