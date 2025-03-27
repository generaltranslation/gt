"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveTranslations = saveTranslations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const errors_1 = require("../../console/errors");
const parseFilesConfig_1 = require("../../fs/config/parseFilesConfig");
/**
 * Saves translations to a local directory
 * @param translations - The translations to save
 * @param translationsDir - The directory to save the translations to
 * @param fileType - The file type to save the translations as (file extension)
 */
function saveTranslations(translations, placeholderPaths, dataFormat) {
    for (const translation of translations) {
        const locale = translation.locale;
        const translationFiles = (0, parseFilesConfig_1.resolveLocaleFiles)(placeholderPaths, locale);
        if (!translationFiles.gt) {
            console.error(errors_1.noFilesError);
            process.exit(1);
        }
        const filepath = translationFiles.gt;
        const translationData = translation.translation;
        // Ensure directory exists
        fs_1.default.mkdirSync(path_1.default.dirname(filepath), { recursive: true });
        // Handle different file types
        if (dataFormat === 'JSX') {
            fs_1.default.writeFileSync(filepath, JSON.stringify(translationData, null, 2));
        }
    }
}
