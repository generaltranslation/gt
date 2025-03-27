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
exports.sendFiles = sendFiles;
const chalk_1 = __importDefault(require("chalk"));
const console_1 = require("../console/console");
/**
 * Sends multiple files for translation to the API
 * @param files - Array of file objects to translate
 * @param options - The options for the API call
 * @returns The translated content or version ID
 */
function sendFiles(files, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { apiKey } = options;
        console.log(chalk_1.default.cyan('\nFiles to translate:'));
        console.log(files.map((file) => `  - ${chalk_1.default.bold(file.fileName)}`).join('\n'));
        console.log();
        const spinner = yield (0, console_1.displayLoadingAnimation)(`Sending ${files.length} file${files.length > 1 ? 's' : ''} to Translation API...`);
        try {
            // Create form data
            const formData = new FormData();
            // Add each file to the form data
            files.forEach((file, index) => {
                formData.append(`file${index}`, new Blob([file.content]), file.fileName);
                formData.append(`fileFormat${index}`, file.fileFormat);
                formData.append(`fileDataFormat${index}`, file.dataFormat); // Only used when translating JSON files
                formData.append(`fileName${index}`, file.fileName);
            });
            // Add number of files
            formData.append('fileCount', String(files.length));
            // Add other metadata
            formData.append('sourceLocale', options.defaultLocale);
            formData.append('targetLocales', JSON.stringify(options.locales));
            formData.append('projectId', options.projectId);
            formData.append('publish', String(options.publish));
            formData.append('versionId', options.versionId || '');
            const response = yield fetch(`${options.baseUrl}/v1/project/translations/files/upload`, {
                method: 'POST',
                headers: Object.assign({}, (apiKey && { 'x-gt-api-key': apiKey })),
                body: formData,
            });
            process.stdout.write('\n\n');
            if (!response.ok) {
                spinner.fail(yield response.text());
                process.exit(1);
            }
            const responseData = yield response.json();
            // Handle version ID response (for async processing)
            const { data, message, locales, translations } = responseData;
            spinner.succeed(message || 'Translation job submitted successfully');
            return { data, locales, translations };
        }
        catch (error) {
            spinner.fail(chalk_1.default.red('Failed to send files for translation'));
            throw error;
        }
    });
}
