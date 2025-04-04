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
const downloadFile_1 = require("../../api/downloadFile");
const downloadFileBatch_1 = require("../../api/downloadFileBatch");
const console_1 = require("../../console/console");
const supportedFiles_1 = require("./supportedFiles");
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
        for (const fileType of supportedFiles_1.SUPPORTED_FILE_EXTENSIONS) {
            if (fileType === 'json')
                continue;
            if (filePaths[fileType]) {
                const files = filePaths[fileType].map((filePath) => {
                    const content = (0, findFilepath_1.readFile)(filePath);
                    const relativePath = (0, findFilepath_1.getRelative)(filePath);
                    return {
                        content,
                        fileName: relativePath,
                        fileFormat: fileType.toUpperCase(),
                        dataFormat,
                    };
                });
                allFiles.push(...files);
            }
        }
        if (allFiles.length === 0) {
            console.error('No files to translate');
            return;
        }
        try {
            // Send all files in a single API call
            const response = yield (0, sendFiles_1.sendFiles)(allFiles, Object.assign(Object.assign({}, options), { publish: false, wait: true }));
            const { data, locales, translations } = response;
            // Create file mapping for all file types
            const fileMapping = createFileMapping(filePaths, placeholderPaths, transformPaths, locales);
            // Process any translations that were already completed and returned with the initial response
            const downloadStatus = yield processInitialTranslations(translations, fileMapping, options);
            // Check for remaining translations
            yield (0, checkFileTranslations_1.checkFileTranslations)(options.apiKey, options.baseUrl, data, locales, 600, (sourcePath, locale) => fileMapping[locale][sourcePath], downloadStatus // Pass the already downloaded files to avoid duplicate requests
            );
        }
        catch (error) {
            console.error('Error translating files:', error);
        }
    });
}
/**
 * Creates a mapping between source files and their translated counterparts for each locale
 */
function createFileMapping(filePaths, placeholderPaths, transformPaths, locales) {
    const fileMapping = {};
    for (const locale of locales) {
        const translatedPaths = (0, parseFilesConfig_1.resolveLocaleFiles)(placeholderPaths, locale);
        const localeMapping = {};
        // Process each file type
        for (const typeIndex of supportedFiles_1.SUPPORTED_FILE_EXTENSIONS) {
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
    return fileMapping;
}
/**
 * Processes translations that were already completed and returned with the initial API response
 * @returns Set of downloaded file+locale combinations
 */
function processInitialTranslations() {
    return __awaiter(this, arguments, void 0, function* (translations = [], fileMapping, options) {
        const downloadStatus = {
            downloaded: new Set(),
            failed: new Set(),
        };
        if (!translations || translations.length === 0) {
            return downloadStatus;
        }
        // Filter for ready translations
        const readyTranslations = translations.filter((translation) => translation.isReady && translation.fileName);
        if (readyTranslations.length > 0) {
            const spinner = yield (0, console_1.displayLoadingAnimation)('Downloading translations...');
            // Prepare batch download data
            const batchFiles = readyTranslations
                .map((translation) => {
                const { locale, fileName, id } = translation;
                const outputPath = fileMapping[locale][fileName];
                if (!outputPath) {
                    return null;
                }
                return {
                    translationId: id,
                    outputPath,
                    fileLocale: `${fileName}:${locale}`,
                };
            })
                .filter(Boolean);
            if (batchFiles.length === 0 || batchFiles[0] === null) {
                return downloadStatus;
            }
            // Use batch download if there are multiple files
            if (batchFiles.length > 1) {
                const batchResult = yield (0, downloadFileBatch_1.downloadFileBatch)(options.baseUrl, options.apiKey, batchFiles.map(({ translationId, outputPath }) => ({
                    translationId,
                    outputPath,
                })));
                // Process results
                batchFiles.forEach((file) => {
                    const { translationId, fileLocale } = file;
                    if (batchResult.successful.includes(translationId)) {
                        downloadStatus.downloaded.add(fileLocale);
                    }
                    else if (batchResult.failed.includes(translationId)) {
                        downloadStatus.failed.add(fileLocale);
                    }
                });
            }
            else if (batchFiles.length === 1) {
                // For a single file, use the original downloadFile method
                const file = batchFiles[0];
                const result = yield (0, downloadFile_1.downloadFile)(options.baseUrl, options.apiKey, file.translationId, file.outputPath);
                if (result) {
                    downloadStatus.downloaded.add(file.fileLocale);
                }
                else {
                    downloadStatus.failed.add(file.fileLocale);
                }
            }
            spinner.succeed('Downloaded cached translations');
        }
        return downloadStatus;
    });
}
