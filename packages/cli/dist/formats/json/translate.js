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
const flattenDictionary_1 = __importDefault(require("../../react/utils/flattenDictionary"));
const id_1 = require("generaltranslation/id");
const sendUpdates_1 = require("../../api/sendUpdates");
const internal_1 = require("generaltranslation/internal");
const path_1 = __importDefault(require("path"));
function translateJson(sourceJson, defaultLocale, locales, library, apiKey, projectId, config, translationsDir) {
    return __awaiter(this, void 0, void 0, function* () {
        const flattened = (0, flattenDictionary_1.default)(sourceJson);
        const updates = [];
        for (const id of Object.keys(flattened)) {
            const source = flattened[id];
            const content = Array.isArray(source) ? source[0] : source;
            const metadata = {
                id,
                // This hash isn't actually used by the GT API, just for consistency sake
                hash: (0, id_1.hashJsxChildren)(Object.assign({ source: content }, (id && { id }))),
            };
            updates.push({
                type: 'jsx',
                source,
                metadata,
            });
        }
        const outputDir = path_1.default.dirname(translationsDir);
        // Actually do the translation
        yield (0, sendUpdates_1.sendUpdates)(updates, {
            apiKey,
            projectId,
            defaultLocale,
            locales,
            baseUrl: internal_1.defaultBaseUrl,
            config,
            publish: false,
            wait: true,
            timeout: '600',
            translationsDir: outputDir,
        });
    });
}
