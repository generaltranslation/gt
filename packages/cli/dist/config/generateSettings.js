"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSettings = generateSettings;
const generaltranslation_1 = require("generaltranslation");
const console_1 = require("../console/console");
const warnings_1 = require("../console/warnings");
const loadConfig_1 = __importDefault(require("../fs/config/loadConfig"));
const internal_1 = require("generaltranslation/internal");
const fs_1 = __importDefault(require("fs"));
const setupConfig_1 = __importDefault(require("../fs/config/setupConfig"));
const parseFilesConfig_1 = require("../fs/config/parseFilesConfig");
/**
 * Generates settings from any
 * @param options - The options to generate settings from
 * @returns The generated settings
 */
function generateSettings(options) {
    var _a, _b;
    // Load config file
    const gtConfig = options.config
        ? (0, loadConfig_1.default)(options.config)
        : (0, loadConfig_1.default)('gt.config.json');
    // Warn if apiKey is present in gt.config.json
    if (gtConfig.apiKey) {
        (0, warnings_1.warnApiKeyInConfig)(options.config);
        process.exit(1);
    }
    // merge options
    const mergedOptions = Object.assign(Object.assign({}, gtConfig), options);
    // merge locales
    mergedOptions.locales = Array.from(new Set([...(gtConfig.locales || []), ...(options.locales || [])]));
    // Add apiKey if not provided
    mergedOptions.apiKey = mergedOptions.apiKey || process.env.GT_API_KEY;
    // Add projectId if not provided
    mergedOptions.projectId =
        mergedOptions.projectId || process.env.GT_PROJECT_ID;
    // Add baseUrl if not provided
    mergedOptions.baseUrl = mergedOptions.baseUrl || internal_1.defaultBaseUrl;
    // Add defaultLocale if not provided
    mergedOptions.defaultLocale = mergedOptions.defaultLocale || 'en';
    // Add locales if not provided
    mergedOptions.locales = mergedOptions.locales || [];
    // Add default config file name if not provided
    mergedOptions.config = mergedOptions.config || 'gt.config.json';
    // Display projectId if present
    if (mergedOptions.projectId)
        (0, console_1.displayProjectId)(mergedOptions.projectId);
    // Check locales
    if (mergedOptions.defaultLocale &&
        !(0, generaltranslation_1.isValidLocale)(mergedOptions.defaultLocale)) {
        console.error(`defaultLocale: ${mergedOptions.defaultLocale} is not a valid locale!`);
        process.exit(1);
    }
    for (const locale of mergedOptions.locales) {
        if (!(0, generaltranslation_1.isValidLocale)(locale)) {
            console.error(`Provided locales: "${(_a = mergedOptions === null || mergedOptions === void 0 ? void 0 : mergedOptions.locales) === null || _a === void 0 ? void 0 : _a.join()}", ${locale} is not a valid locale!`);
            process.exit(1);
        }
    }
    // Resolve all glob patterns in the files object
    mergedOptions.files = (0, parseFilesConfig_1.resolveFiles)(mergedOptions.files || {}, mergedOptions.defaultLocale);
    // if there's no existing config file, creates one
    // does not include the API key to avoid exposing it
    if (!fs_1.default.existsSync(mergedOptions.config)) {
        (0, setupConfig_1.default)(mergedOptions.config, {
            projectId: mergedOptions.projectId,
            defaultLocale: mergedOptions.defaultLocale,
            locales: ((_b = mergedOptions.locales) === null || _b === void 0 ? void 0 : _b.length) > 0 ? mergedOptions.locales : undefined,
        });
    }
    return mergedOptions;
}
