"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initGT = initGT;
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
var defaultInitGTProps_1 = __importDefault(require("./config/props/defaultInitGTProps"));
var createErrors_1 = require("./errors/createErrors");
var supported_locales_1 = require("@generaltranslation/supported-locales");
/**
 * Initializes General Translation settings for a Next.js application.
 *
 * Use it in `next.config.js` to enable GT translation functionality as a plugin.
 *
 * @example
 * // In next.config.mjs
 * import { initGT } from 'gt-next/config';
 *
 * const withGT = initGT({
 *   projectId: 'abc-123',
 *   locales: ['en', 'es', 'fr'],
 *   defaultLocale: 'en'
 * });
 *
 * export default withGT({})
 *
 * @param {string|undefined} config - Optional config filepath (defaults to './gt.config.json'). If a file is found, it will be parsed for GT config variables.
 * @param {string|undefined} i18n - Optional i18n configuration file path. If a string is provided, it will be used as a path.
 * @param {string|undefined} dictionary - Optional dictionary configuration file path. If a string is provided, it will be used as a path.
 * @param {string} [apiKey=defaultInitGTProps.apiKey] - API key for the GeneralTranslation service. Required if using the default GT base URL.
 * @param {string} [devApiKey=defaultInitGTProps.devApiKey] - API key for dev environment only.
 * @param {string} [projectId=defaultInitGTProps.projectId] - Project ID for the GeneralTranslation service. Required for most functionality.
 * @param {string|null} [runtimeUrl=defaultInitGTProps.runtimeUrl] - The base URL for the GT API. Set to an empty string to disable automatic translations. Set to null to disable.
 * @param {string|null} [cacheUrl=defaultInitGTProps.cacheUrl] - The URL for cached translations. Set to null to disable.
 * @param {number} [cacheExpiryTime=defaultInitGTProps.cacheExpiryTime] - How long to cache translations in memory (milliseconds).
 * @param {boolean} [runtimeTranslation=defaultInitGTProps.runtimeTranslation] - Whether to enable runtime translation.
 * @param {string[]|undefined} - Whether to use local translations.
 * @param {string[]} [locales=defaultInitGTProps.locales] - List of supported locales for the application.
 * @param {string} [defaultLocale=defaultInitGTProps.defaultLocale] - The default locale to use if none is specified.
 * @param {object} [renderSettings=defaultInitGTProps.renderSettings] - Render settings for how translations should be handled.
 * @param {number} [maxConcurrentRequests=defaultInitGTProps.maxConcurrentRequests] - Maximum number of concurrent requests allowed.
 * @param {number} [maxBatchSize=defaultInitGTProps.maxBatchSize] - Maximum translation requests in the same batch.
 * @param {number} [batchInterval=defaultInitGTProps.batchInterval] - The interval in milliseconds between batched translation requests.
 * @param {object} metadata - Additional metadata that can be passed for extended configuration.
 *
 * @returns {function(NextConfig): NextConfig} - A function that accepts a Next.js config object and returns an updated config with GT settings applied.
 *
 * @throws {Error} If the project ID is missing and default URLs are used, or if the API key is required and missing.
 *
 */
function initGT(props) {
    var _a;
    // ---------- LOAD GT CONFIG FILE ---------- //
    var loadedConfig = {};
    var configPath = props.config || defaultInitGTProps_1.default.config;
    try {
        if (typeof configPath === 'string' && fs_1.default.existsSync(configPath)) {
            var fileContent = fs_1.default.readFileSync(configPath, 'utf-8');
            loadedConfig = JSON.parse(fileContent);
        }
    }
    catch (error) {
        console.error('Error reading GT config file:', error);
    }
    // ---------- LOAD ENVIRONMENT VARIABLES ---------- //
    // resolve project ID
    var projectId = process.env.GT_PROJECT_ID;
    // resolve API keys
    var envApiKey = process.env.GT_API_KEY;
    var apiKey, devApiKey;
    if (envApiKey) {
        var apiKeyType = (_a = envApiKey === null || envApiKey === void 0 ? void 0 : envApiKey.split('-')) === null || _a === void 0 ? void 0 : _a[1];
        if (apiKeyType === 'api') {
            apiKey = envApiKey;
        }
        else if (apiKeyType === 'dev') {
            devApiKey = envApiKey;
        }
    }
    // conditionally add environment variables to config
    var envConfig = __assign(__assign(__assign({}, (projectId ? { projectId: projectId } : {})), (apiKey ? { apiKey: apiKey } : {})), (devApiKey ? { devApiKey: devApiKey } : {}));
    // ---------- MERGE CONFIGS ---------- //
    // precedence: input > env > config file > defaults
    var mergedConfig = __assign(__assign(__assign(__assign(__assign({}, defaultInitGTProps_1.default), loadedConfig), envConfig), props), { _usingPlugin: true });
    // ----------- LOCALE STANDARDIZATION ----------- //
    if (mergedConfig.locales && mergedConfig.defaultLocale) {
        mergedConfig.locales.unshift(mergedConfig.defaultLocale);
    }
    mergedConfig.locales = Array.from(new Set(mergedConfig.locales));
    // ----------- RESOLVE ANY CONFIG/TX FILES ----------- //
    // Resolve custom locale getter functions
    var resolvedI18NFilePath = typeof mergedConfig.i18n === 'string'
        ? mergedConfig.i18n
        : resolveConfigFilepath('i18n');
    // Resolve dictionary filepath
    var resolvedDictionaryFilePath = typeof mergedConfig.dictionary === 'string'
        ? mergedConfig.dictionary
        : resolveConfigFilepath('dictionary');
    // Resolve custom translation loader path
    var customLoadTranslationPath = typeof mergedConfig.loadTranslationPath === 'string'
        ? mergedConfig.loadTranslationPath
        : resolveConfigFilepath('loadTranslation');
    // Resolve local translations directory
    var resolvedLocalTranslationDir = typeof mergedConfig.localTranslationsDir === 'string'
        ? mergedConfig.localTranslationsDir
        : './public/_gt';
    // Check for local translations and get the list of locales
    var localLocales = [];
    if (fs_1.default.existsSync(resolvedLocalTranslationDir) &&
        fs_1.default.statSync(resolvedLocalTranslationDir).isDirectory()) {
        localLocales = fs_1.default
            .readdirSync(resolvedLocalTranslationDir)
            .filter(function (file) { return file.endsWith('.json'); })
            .map(function (file) { return file.replace('.json', ''); });
    }
    // When there are local translations, force custom translation loader
    // for now, we can just check if that file exists, and then assume the existance of the loaders
    if (customLoadTranslationPath &&
        fs_1.default.existsSync(path_1.default.resolve(customLoadTranslationPath))) {
        mergedConfig.loadTranslationType = 'custom';
    }
    // ---------- ERROR CHECKS ---------- //
    // Check: local translations are enabled, but no custom translation loader is found
    if (localLocales.length && mergedConfig.loadTranslationType !== 'custom') {
        throw new Error((0, createErrors_1.createMissingCustomTranslationLoadedError)(customLoadTranslationPath));
    }
    // Check: projectId is not required for remote infrastructure, but warn if missing for dev, nothing for prod
    if ((mergedConfig.cacheUrl || mergedConfig.runtimeUrl) &&
        !mergedConfig.projectId &&
        process.env.NODE_ENV === 'development' &&
        mergedConfig.loadTranslationType !== 'custom') {
        console.warn(createErrors_1.projectIdMissingWarn);
    }
    // Check: dev API key should not be included in production
    if (process.env.NODE_ENV === 'production' && mergedConfig.devApiKey) {
        throw new Error(createErrors_1.devApiKeyIncludedInProductionError);
    }
    // Check: An API key is required for runtime translation
    if (mergedConfig.projectId && // must have projectId for this check to matter anyways
        mergedConfig.runtimeUrl &&
        mergedConfig.loadTranslationType !== 'custom' && // this usually conincides with not using runtime tx
        !(mergedConfig.apiKey || mergedConfig.devApiKey) &&
        process.env.NODE_ENV === 'development') {
        console.warn(createErrors_1.APIKeyMissingWarn);
    }
    // Check: if using GT infrastructure, warn about unsupported locales
    if (mergedConfig.runtimeUrl === defaultInitGTProps_1.default.runtimeUrl ||
        (mergedConfig.cacheUrl === defaultInitGTProps_1.default.cacheUrl &&
            mergedConfig.loadTranslationType === 'remote')) {
        var warningLocales = (mergedConfig.locales || defaultInitGTProps_1.default.locales).filter(function (locale) { return !(0, supported_locales_1.getSupportedLocale)(locale); });
        if (warningLocales.length) {
            console.warn((0, createErrors_1.createUnsupportedLocalesWarning)(warningLocales));
        }
    }
    // ---------- STORE CONFIGURATIONS ---------- //
    // Store the resolved paths in the environment
    var I18NConfigParams = JSON.stringify(mergedConfig);
    return function (nextConfig) {
        var _a;
        if (nextConfig === void 0) { nextConfig = {}; }
        return __assign(__assign({}, nextConfig), { env: __assign(__assign({}, nextConfig.env), { _GENERALTRANSLATION_I18N_CONFIG_PARAMS: I18NConfigParams }), experimental: __assign(__assign({}, nextConfig.experimental), (((_a = nextConfig.experimental) === null || _a === void 0 ? void 0 : _a.turbo)
                ? {
                    turbo: __assign(__assign({}, (nextConfig.experimental.turbo || {})), { resolveAlias: __assign(__assign({}, (nextConfig.experimental.turbo.resolveAlias || {})), { 'gt-next/_request': resolvedI18NFilePath || '', 'gt-next/_dictionary': resolvedDictionaryFilePath || '', 'gt-next/_load-translation': customLoadTranslationPath || '' }) }),
                }
                : {})), 
            // Keep existing webpack config for backward compatibility
            webpack: function webpack() {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var webpackConfig = _a[0], options = _a[1];
                if (resolvedI18NFilePath) {
                    webpackConfig.resolve.alias['gt-next/_request'] = path_1.default.resolve(webpackConfig.context, resolvedI18NFilePath);
                }
                if (resolvedDictionaryFilePath) {
                    webpackConfig.resolve.alias['gt-next/_dictionary'] = path_1.default.resolve(webpackConfig.context, resolvedDictionaryFilePath);
                }
                if (customLoadTranslationPath) {
                    webpackConfig.resolve.alias["gt-next/_load-translation"] =
                        path_1.default.resolve(webpackConfig.context, customLoadTranslationPath);
                }
                if (typeof (nextConfig === null || nextConfig === void 0 ? void 0 : nextConfig.webpack) === 'function') {
                    return nextConfig.webpack(webpackConfig, options);
                }
                return webpackConfig;
            } });
    };
}
/**
 * Resolves a configuration filepath for i18n or dictionary files.
 *
 * @param {string} fileName - The base name of the config file to look for.
 * @param {string} [cwd] - An optional current working directory path.
 * @returns {string|undefined} - The path if found; otherwise undefined.
 */
function resolveConfigFilepath(fileName, cwd) {
    function resolvePath(pathname) {
        var parts = [];
        if (cwd)
            parts.push(cwd);
        parts.push(pathname);
        return path_1.default.resolve.apply(path_1.default, parts);
    }
    function pathExists(pathname) {
        return fs_1.default.existsSync(resolvePath(pathname));
    }
    // Check for file existence in the root and src directories with supported extensions
    for (var _i = 0, _a = __spreadArray(__spreadArray([], withExtensions("./".concat(fileName)), true), withExtensions("./src/".concat(fileName)), true); _i < _a.length; _i++) {
        var candidate = _a[_i];
        if (pathExists(candidate)) {
            return candidate;
        }
    }
    // Return undefined if no file is found
    return undefined;
}
/**
 * Helper function to handle multiple extensions.
 *
 * @param {string} localPath - The local path to which extensions will be appended.
 * @returns {string[]} - Array of possible paths with supported TypeScript/JavaScript extensions.
 */
function withExtensions(localPath) {
    return [
        "".concat(localPath, ".ts"),
        "".concat(localPath, ".tsx"),
        "".concat(localPath, ".js"),
        "".concat(localPath, ".jsx"),
    ];
}
//# sourceMappingURL=config.js.map