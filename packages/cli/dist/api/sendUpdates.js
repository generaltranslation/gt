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
exports.sendUpdates = sendUpdates;
const chalk_1 = __importDefault(require("chalk"));
const console_1 = require("../console/console");
const updateConfig_1 = __importDefault(require("../fs/config/updateConfig"));
const waitForUpdates_1 = require("./waitForUpdates");
const saveTranslations_1 = __importDefault(require("../fs/saveTranslations"));
function sendUpdates(updates, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { apiKey, projectId, defaultLocale } = options;
        const globalMetadata = Object.assign(Object.assign({}, (projectId && { projectId })), (defaultLocale && { sourceLocale: defaultLocale }));
        // If additionalLocales is provided, additionalLocales + project.current_locales will be translated
        // If not, then options.locales will be translated
        // If neither, then project.current_locales will be translated
        const body = Object.assign(Object.assign(Object.assign(Object.assign({ updates }, (options.locales && { locales: options.locales })), (options.additionalLocales && {
            additionalLocales: options.additionalLocales,
        })), { metadata: globalMetadata, publish: options.publish }), (options.versionId && { versionId: options.versionId }));
        const spinner = yield (0, console_1.displayLoadingAnimation)('Sending updates to General Translation API...');
        try {
            const startTime = Date.now();
            const response = yield fetch(`${options.baseUrl}/v1/project/translations/update`, {
                method: 'POST',
                headers: Object.assign({ 'Content-Type': 'application/json' }, (apiKey && { 'x-gt-api-key': apiKey })),
                body: JSON.stringify(body),
            });
            process.stdout.write('\n\n');
            if (!response.ok) {
                spinner.fail(yield response.text());
                process.exit(1);
            }
            if (response.status === 204) {
                spinner.succeed(yield response.text());
                return;
            }
            const { versionId, message, locales } = yield response.json();
            spinner.succeed(chalk_1.default.green(message));
            if (options.config)
                (0, updateConfig_1.default)(Object.assign({ configFilepath: options.config, _versionId: versionId }, (options.locales && { locales: options.locales })));
            // Wait for translations if wait is true
            if (options.wait && locales) {
                console.log();
                // timeout was validated earlier
                const timeout = parseInt(options.timeout) * 1000;
                const result = yield (0, waitForUpdates_1.waitForUpdates)(apiKey, options.baseUrl, versionId, locales, startTime, timeout);
            }
            // Save translations to local directory if translationsDir is provided
            if (options.translationsDir) {
                console.log();
                yield (0, saveTranslations_1.default)(options.baseUrl, apiKey, versionId, options.translationsDir);
            }
        }
        catch (error) {
            spinner.fail(chalk_1.default.red('Failed to send updates'));
            throw error;
        }
    });
}
