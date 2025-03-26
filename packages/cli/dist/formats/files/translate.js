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
const errors_1 = require("../../console/errors");
const parseFilesConfig_1 = require("../../fs/config/parseFilesConfig");
const findFilepath_1 = require("../../fs/findFilepath");
const flattenDictionary_1 = require("../../react/utils/flattenDictionary");
const path_1 = __importDefault(require("path"));
const SUPPORTED_DATA_FORMATS = ['JSX', 'ICU', 'I18NEXT'];
/**
 * Sends multiple files to the API for translation
 * @param filePaths - Resolved file paths for different file types
 * @param placeholderPaths - Placeholder paths for translated files
 * @param transformPaths - Transform paths for file naming
 * @param fileFormat - Format of the files
 * @param dataFormat - Format of the data within the files
 * @param options - Translation options including API settings
 * @returns Promise that resolves when translation is complete
 */
function translateFiles(filePaths_1, placeholderPaths_1, transformPaths_1) {
    return __awaiter(this, arguments, void 0, function* (filePaths, placeholderPaths, transformPaths, dataFormat = 'JSX', options) {
        // Collect all files to translate
        const allFiles = [];
        // Process JSON files
        if (filePaths.json) {
            if (!SUPPORTED_DATA_FORMATS.includes(dataFormat)) {
                console.error(errors_1.noSupportedDataFormatError);
                process.exit(1);
            }
            const jsonFiles = filePaths.json.map((filePath) => {
                const content = (0, findFilepath_1.readFile)(filePath);
                const json = JSON.parse(content);
                // Just to validate the JSON is valid
                (0, flattenDictionary_1.flattenJsonDictionary)(json);
                const relativePath = (0, findFilepath_1.getRelative)(filePath);
                return {
                    content,
                    fileName: relativePath,
                    fileFormat: 'JSON',
                    dataFormat,
                };
            });
            allFiles.push(...jsonFiles);
        }
        // Process MDX files
        if (filePaths.mdx) {
            const mdxFiles = filePaths.mdx.map((filePath) => {
                const content = (0, findFilepath_1.readFile)(filePath);
                const relativePath = (0, findFilepath_1.getRelative)(filePath);
                return {
                    content,
                    fileName: relativePath,
                    fileFormat: 'MDX',
                    dataFormat,
                };
            });
            allFiles.push(...mdxFiles);
        }
        // Process MD files
        if (filePaths.md) {
            const mdFiles = filePaths.md.map((filePath) => {
                const content = (0, findFilepath_1.readFile)(filePath);
                const relativePath = (0, findFilepath_1.getRelative)(filePath);
                return {
                    content,
                    fileName: relativePath,
                    fileFormat: 'MD',
                    dataFormat,
                };
            });
            allFiles.push(...mdFiles);
        }
        if (allFiles.length === 0) {
            console.error('No files to translate');
            return;
        }
        try {
            // Send all files in a single API call
            const response = yield (0, sendFiles_1.sendFiles)(allFiles, Object.assign(Object.assign({}, options), { publish: false, wait: true }));
            const { data, locales } = response;
            // Create file mapping for all file types
            const fileMapping = {};
            for (const locale of locales) {
                const translatedPaths = (0, parseFilesConfig_1.resolveLocaleFiles)(placeholderPaths, locale);
                const localeMapping = {};
                // Process each file type
                for (const typeIndex of ['json', 'mdx', 'md']) {
                    if (!filePaths[typeIndex] || !translatedPaths[typeIndex])
                        continue;
                    const sourcePaths = filePaths[typeIndex];
                    let translatedFiles = translatedPaths[typeIndex];
                    if (!translatedFiles)
                        continue;
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
                    for (let i = 0; i < sourcePaths.length; i++) {
                        const sourceFile = (0, findFilepath_1.getRelative)(sourcePaths[i]);
                        const translatedFile = (0, findFilepath_1.getRelative)(translatedFiles[i]);
                        localeMapping[sourceFile] = translatedFile;
                    }
                }
                fileMapping[locale] = localeMapping;
            }
            yield (0, checkFileTranslations_1.checkFileTranslations)(options.apiKey, options.baseUrl, data, locales, 600, (sourcePath, locale) => {
                return fileMapping[locale][sourcePath];
            });
        }
        catch (error) {
            console.error('Error translating files:', error);
        }
    });
}
