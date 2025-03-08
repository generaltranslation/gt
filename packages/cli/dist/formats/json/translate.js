"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateJson = translateJson;
const flattenDictionary_1 = require("../../react/utils/flattenDictionary");
const sendUpdates_1 = require("../../api/sendUpdates");
const path_1 = __importDefault(require("path"));
const fetchTranslations_1 = require("../../api/fetchTranslations");
const save_1 = require("./save");
const errors_1 = require("../../console/errors");
/**
 * Translates a JSON object and saves the translations to a local directory
 * @param sourceJson - The source JSON object
 * @param defaultLocale - The default locale
 * @param locales - The locales to translate to
 * @param library - The library to use
 * @param apiKey - The API key for the General Translation API
 * @param projectId - The project ID
 * @param config - The config file path
 * @param translationsDir - The directory to save the translations to
 * @param fileType - The file type to save the translations as (file extension)
 */
function translateJson(sourceJson, settings, dataFormat, fileExtension) {
    return __awaiter(this, void 0, void 0, function* () {
        const flattened = (0, flattenDictionary_1.flattenJsonDictionary)(sourceJson);
        const updates = [];
        for (const id of Object.keys(flattened)) {
            const source = flattened[id];
            const metadata = {
                id,
            };
            updates.push({
                dataFormat,
                source,
                metadata,
            });
        }
        if (!settings.translationsDir) {
            console.error(errors_1.noTranslationsDirError);
            process.exit(1);
        }
        const outputDir = path_1.default.dirname(settings.translationsDir);
        // Actually do the translation
        const updateResponse = yield (0, sendUpdates_1.sendUpdates)(updates, Object.assign(Object.assign({}, settings), { publish: false, wait: true, timeout: '600', translationsDir: outputDir, dataFormat }));
        if (updateResponse === null || updateResponse === void 0 ? void 0 : updateResponse.versionId) {
            const translations = yield (0, fetchTranslations_1.fetchTranslations)(settings.baseUrl, settings.apiKey, updateResponse.versionId);
            (0, save_1.saveTranslations)(translations, outputDir, dataFormat, fileExtension);
        }
    });
}
