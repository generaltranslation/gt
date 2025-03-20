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
exports.translateFiles = translateFiles;
const checkFileTranslations_1 = require("../../api/checkFileTranslations");
const sendFiles_1 = require("../../api/sendFiles");
const parseFilesConfig_1 = require("../../fs/config/parseFilesConfig");
const findFilepath_1 = require("../../fs/findFilepath");
const path_1 = __importDefault(require("path"));
/**
 * Sends an entire file to the API for translation
 * @param fileContent - The raw content of the file to translate
 * @param options - Translation options including API settings
 * @returns The translated file content or null if translation failed
 */
function translateFiles(filePaths, placeholderPaths, transformPaths, fileFormat, options) {
    return __awaiter(this, void 0, void 0, function* () {
        let typeIndex = 'json';
        if (fileFormat === 'MDX') {
            typeIndex = 'mdx';
        }
        else if (fileFormat === 'MD') {
            typeIndex = 'md';
        }
        else if (fileFormat === 'JSON') {
            typeIndex = 'json';
        }
        const sourcePaths = filePaths[typeIndex];
        try {
            if (!sourcePaths) {
                console.error('No files to translate');
                return;
            }
            const files = sourcePaths.map((filePath) => {
                const content = (0, findFilepath_1.readFile)(filePath);
                const relativePath = (0, findFilepath_1.getRelative)(filePath);
                return {
                    content,
                    fileName: relativePath,
                    fileFormat,
                };
            });
            const response = yield (0, sendFiles_1.sendFiles)(files, Object.assign(Object.assign({}, options), { publish: false, wait: true }));
            const { data, locales } = response;
            const fileMapping = {};
            for (const locale of locales) {
                const translatedPaths = (0, parseFilesConfig_1.resolveLocaleFiles)(placeholderPaths, locale);
                let translatedFiles = translatedPaths[typeIndex];
                if (!translatedFiles) {
                    continue; // shouldn't happen; typing
                }
                const transformPath = transformPaths[typeIndex];
                if (transformPath) {
                    translatedFiles = translatedFiles.map((filePath) => {
                        const directory = path_1.default.dirname(filePath);
                        const fileName = path_1.default.basename(filePath);
                        const baseName = fileName.split('.')[0];
                        const transformedFileName = transformPath
                            .replace('*', baseName)
                            .replace('[locale]', locale);
                        return path_1.default.join(directory, transformedFileName);
                    });
                }
                const localeMapping = {};
                for (let i = 0; i < sourcePaths.length; i++) {
                    const sourceFile = (0, findFilepath_1.getRelative)(sourcePaths[i]);
                    const translatedFile = (0, findFilepath_1.getRelative)(translatedFiles[i]);
                    localeMapping[sourceFile] = translatedFile;
                }
                fileMapping[locale] = localeMapping;
            }
            yield (0, checkFileTranslations_1.checkFileTranslations)(options.apiKey, options.baseUrl, data, locales, 600, (sourcePath, locale) => {
                return fileMapping[locale][sourcePath];
            });
        }
        catch (error) {
            console.error('Error translating file:', error);
        }
    });
}
