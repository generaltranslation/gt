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
exports.fetchTranslations = fetchTranslations;
const chalk_1 = __importDefault(require("chalk"));
/**
 * Fetches translations from the API and saves them to a local directory
 * @param baseUrl - The base URL for the API
 * @param apiKey - The API key for the API
 * @param versionId - The version ID of the project
 * @param translationsDir - The directory to save the translations to
 * @param fileType - The file type to save the translations as (file extension)
 */
function fetchTranslations(baseUrl, apiKey, versionId) {
    return __awaiter(this, void 0, void 0, function* () {
        // First fetch the translations from the API
        const response = yield fetch(`${baseUrl}/v1/project/translations/info/${encodeURIComponent(versionId)}`, {
            method: 'GET',
            headers: Object.assign({ 'Content-Type': 'application/json' }, (apiKey && { 'x-gt-api-key': apiKey })),
        });
        if (response.ok) {
            const data = yield response.json();
            const translations = data.translations;
            return translations;
        }
        else {
            console.error(chalk_1.default.red('Failed to fetch translations'));
        }
        return [];
    });
}
