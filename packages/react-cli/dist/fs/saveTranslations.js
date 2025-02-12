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
exports.default = saveTranslations;
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function saveTranslations(baseUrl, apiKey, versionId, translationsDir) {
    return __awaiter(this, void 0, void 0, function* () {
        // First fetch the translations from the API
        const response = yield fetch(`${baseUrl}/v1/project/translations/info/${encodeURIComponent(versionId)}`, {
            method: 'GET',
            headers: Object.assign({ 'Content-Type': 'application/json' }, (apiKey && { 'x-gt-api-key': apiKey })),
        });
        if (response.ok) {
            const data = yield response.json();
            const translations = data.translations;
            for (const translation of translations) {
                const locale = translation.locale;
                const translationData = translation.translation;
                const filepath = path_1.default.join(translationsDir, `${locale}.json`);
                // Ensure directory exists
                fs_1.default.mkdirSync(path_1.default.dirname(filepath), { recursive: true });
                fs_1.default.writeFileSync(filepath, JSON.stringify(translationData, null, 2));
            }
            console.log(chalk_1.default.green('Translations saved successfully!'));
        }
        else {
            console.error(chalk_1.default.red('Failed to fetch translations'));
        }
    });
}
