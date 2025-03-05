"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveTranslations = saveTranslations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Saves translations to a local directory
 * @param translations - The translations to save
 * @param translationsDir - The directory to save the translations to
 * @param fileType - The file type to save the translations as (file extension)
 */
function saveTranslations(translations, translationsDir, dataType, fileExtension) {
    for (const translation of translations) {
        const locale = translation.locale;
        const translationData = translation.translation;
        const filepath = path_1.default.join(translationsDir, `${locale}.${fileExtension}`);
        // Ensure directory exists
        fs_1.default.mkdirSync(path_1.default.dirname(filepath), { recursive: true });
        // Handle different file types
        if (dataType === 'gt-json') {
            fs_1.default.writeFileSync(filepath, JSON.stringify(translationData, null, 2));
        }
    }
}
