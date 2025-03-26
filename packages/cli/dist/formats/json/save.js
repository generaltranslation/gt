"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveTranslations = saveTranslations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const parseFilesConfig_1 = require("../../fs/config/parseFilesConfig");
const errors_1 = require("../../console/errors");
/**
 * Saves translations to a file
 * @param translations - The translations to save
 * @param filePath - The file path to save the translations to
 * @param dataFormat - The data format to save the translations as
 * @deprecated Use saveFiles instead
 */
function saveTranslations(translations, placeholderPaths, dataFormat) {
    for (const translation of translations) {
        const locale = translation.locale;
        const translationFiles = (0, parseFilesConfig_1.resolveLocaleFiles)(placeholderPaths, locale);
        if (!translationFiles.json) {
            console.error(errors_1.noFilesError);
            process.exit(1);
        }
        const translationData = translation.translation;
        const translationMetadata = translation.metadata;
        // Ensure directory exists
        fs_1.default.mkdirSync(path_1.default.dirname(translationFiles.json[0]), { recursive: true });
        // Handle different file types
        let writeData;
        if (dataFormat === 'ICU' ||
            dataFormat === 'I18NEXT' ||
            dataFormat === 'JSX') {
            // JSONs need to be mapped back to the original format
            const revertedJson = {};
            for (const hash in translationData) {
                const metadata = translationMetadata[hash];
                const entry = translationData[hash];
                if (metadata.id) {
                    const keyPath = metadata.id.split('.');
                    let current = revertedJson;
                    // Process all keys except the last one
                    for (let i = 0; i < keyPath.length - 1; i++) {
                        const key = keyPath[i];
                        // Make sure the current key points to an object
                        if (!current[key] ||
                            typeof current[key] !== 'object' ||
                            Array.isArray(current[key])) {
                            current[key] = {};
                        }
                        current = current[key];
                    }
                    // Set the value at the last key
                    current[keyPath[keyPath.length - 1]] = entry;
                }
            }
            writeData = JSON.stringify(revertedJson, null, 2);
        }
        // else if (dataFormat === 'yaml') {
        //   writeData = yaml.stringify(translationData);
        // }
        if (writeData) {
            fs_1.default.writeFileSync(translationFiles.json[0], writeData);
        }
    }
}
