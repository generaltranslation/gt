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
exports.checkFileTranslations = checkFileTranslations;
const chalk_1 = __importDefault(require("chalk"));
const console_1 = require("../console/console");
const generaltranslation_1 = require("generaltranslation");
const downloadFile_1 = require("./downloadFile");
/**
 * Checks the status of translations for a given version ID
 * @param apiKey - The API key for the General Translation API
 * @param baseUrl - The base URL for the General Translation API
 * @param versionId - The version ID of the project
 * @param locales - The locales to wait for
 * @param startTime - The start time of the wait
 * @param timeoutDuration - The timeout duration for the wait in seconds
 * @returns True if all translations are deployed, false otherwise
 */
function checkFileTranslations(apiKey, baseUrl, data, locales, timeoutDuration, resolveOutputPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const startTime = Date.now();
        const spinner = yield (0, console_1.displayLoadingAnimation)('Waiting for translation...');
        const availableLocales = [];
        const downloadedFiles = new Set(); // Track which file+locale combinations have been downloaded
        let fileQueryData = [];
        // Initialize the query data
        for (const file in data) {
            for (const locale of locales) {
                fileQueryData.push({
                    versionId: data[file].versionId,
                    fileName: data[file].canonicalName,
                    locale,
                });
            }
        }
        const checkDeployment = () => __awaiter(this, void 0, void 0, function* () {
            try {
                // Only query for files that haven't been downloaded yet
                const currentQueryData = fileQueryData.filter((item) => !downloadedFiles.has(`${item.fileName}:${item.locale}`));
                // If all files have been downloaded, we're done
                if (currentQueryData.length === 0) {
                    return true;
                }
                const response = yield fetch(`${baseUrl}/v1/project/translations/files/retrieve`, {
                    method: 'POST',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, (apiKey && { 'x-gt-api-key': apiKey })),
                    body: JSON.stringify({ files: currentQueryData }),
                });
                if (response.ok) {
                    const responseData = yield response.json();
                    const translations = responseData.translations || [];
                    // Process available translations
                    for (const translation of translations) {
                        const locale = translation.locale;
                        const fileName = data[translation.fileName].canonicalName;
                        if (translation.isReady && fileName) {
                            // Mark this file+locale as downloaded
                            downloadedFiles.add(`${fileName}:${locale}`);
                            // Download the file
                            const outputPath = resolveOutputPath(fileName, locale);
                            yield (0, downloadFile_1.downloadFile)(baseUrl, apiKey, translation.fileId, outputPath);
                            // Update available locales for display
                            if (!availableLocales.includes(locale) &&
                                locales.includes(locale)) {
                                availableLocales.push(locale);
                            }
                        }
                    }
                    // Update the spinner text
                    const newSuffixText = [
                        `\n\n` +
                            chalk_1.default.green(`${availableLocales.length}/${locales.length}`) +
                            ` translations completed`,
                        ...availableLocales.map((locale) => {
                            const localeProperties = (0, generaltranslation_1.getLocaleProperties)(locale);
                            return `Translation completed for ${chalk_1.default.green(localeProperties.name)} (${chalk_1.default.green(localeProperties.code)})`;
                        }),
                    ];
                    spinner.suffixText = newSuffixText.join('\n');
                    // Check if all locales are available
                    if (locales.every((locale) => availableLocales.includes(locale))) {
                        return true;
                    }
                }
                return false;
            }
            catch (error) {
                console.error('Error checking translation status:', error);
                return false;
            }
        });
        // Calculate time until next 5-second interval since startTime
        const msUntilNextInterval = Math.max(0, 5000 - ((Date.now() - startTime) % 5000));
        // Do first check immediately
        const initialCheck = yield checkDeployment();
        if (initialCheck) {
            spinner.succeed(chalk_1.default.green('All translations are live!'));
            return true;
        }
        return new Promise((resolve) => {
            let intervalCheck;
            // Start the interval aligned with the original request time
            setTimeout(() => {
                intervalCheck = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                    const isDeployed = yield checkDeployment();
                    const elapsed = Date.now() - startTime;
                    if (isDeployed || elapsed >= timeoutDuration * 1000) {
                        process.stdout.write('\n');
                        clearInterval(intervalCheck);
                        if (isDeployed) {
                            spinner.succeed(chalk_1.default.green('All translations are live!'));
                            resolve(true);
                        }
                        else {
                            spinner.fail(chalk_1.default.red('Timed out waiting for translations'));
                            resolve(false);
                        }
                    }
                }), 5000);
            }, msUntilNextInterval);
        });
    });
}
