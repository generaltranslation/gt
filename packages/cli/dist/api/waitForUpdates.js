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
exports.waitForUpdates = void 0;
const chalk_1 = __importDefault(require("chalk"));
const console_1 = require("../console/console");
const generaltranslation_1 = require("generaltranslation");
/**
 * Waits for translations to be deployed to the General Translation API
 * @param apiKey - The API key for the General Translation API
 * @param baseUrl - The base URL for the General Translation API
 * @param versionId - The version ID of the project
 * @param locales - The locales to wait for
 * @param startTime - The start time of the wait
 * @param timeoutDuration - The timeout duration for the wait
 * @returns True if all translations are deployed, false otherwise
 */
const waitForUpdates = (apiKey, baseUrl, versionId, locales, startTime, timeoutDuration) => __awaiter(void 0, void 0, void 0, function* () {
    const spinner = yield (0, console_1.displayLoadingAnimation)('Waiting for translation...');
    const availableLocales = [];
    const checkDeployment = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const response = yield fetch(`${baseUrl}/v1/project/translations/status/${encodeURIComponent(versionId)}`, {
                method: 'GET',
                headers: Object.assign({ 'Content-Type': 'application/json' }, (apiKey && { 'x-gt-api-key': apiKey })),
            });
            if (response.ok) {
                const data = yield response.json();
                if (data.availableLocales) {
                    data.availableLocales.forEach((locale) => {
                        if (!availableLocales.includes(locale) &&
                            locales.includes(locale)) {
                            availableLocales.push(locale);
                        }
                    });
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
                }
                if (locales.every((locale) => availableLocales.includes(locale))) {
                    return true;
                }
            }
            return false;
        }
        catch (error) {
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
            intervalCheck = setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
                const isDeployed = yield checkDeployment();
                const elapsed = Date.now() - startTime;
                if (isDeployed || elapsed >= timeoutDuration) {
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
exports.waitForUpdates = waitForUpdates;
