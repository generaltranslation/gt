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
function saveTranslations(translations, translationsDir, dataFormat, fileExtension) {
    for (const translation of translations) {
        const locale = translation.locale;
        const translationData = translation.translation;
        const translationMetadata = translation.metadata;
        const filepath = path_1.default.join(translationsDir, `${locale}.${fileExtension}`);
        // Ensure directory exists
        fs_1.default.mkdirSync(path_1.default.dirname(filepath), { recursive: true });
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
            fs_1.default.writeFileSync(filepath, writeData);
        }
    }
}
