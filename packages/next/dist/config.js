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
exports.initGT = void 0;
exports.withGTConfig = withGTConfig;
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
var defaultWithGTConfigProps_1 = __importDefault(require("./config-dir/props/defaultWithGTConfigProps"));
var createErrors_1 = require("./errors/createErrors");
var supported_locales_1 = require("@generaltranslation/supported-locales");
var generaltranslation_1 = require("generaltranslation");
/**
 * Initializes General Translation settings for a Next.js application.
 *
 * Use it in `next.config.js` to enable GT translation functionality as a plugin.
 *
 * @example
 * // In next.config.mjs
 * import { withGTConfig } from 'gt-next/config';
 *
 * export default withGTConfig(nextConfig, {
 *   projectId: 'abc-123',
 *   locales: ['en', 'es', 'fr'],
 *   defaultLocale: 'en'
 * })
 *
 * @param {string|undefined} config - Optional config filepath (defaults to './gt.config.json'). If a file is found, it will be parsed for GT config variables.
 * @param {string|undefined} dictionary - Optional dictionary configuration file path. If a string is provided, it will be used as a path.
 * @param {string} [apiKey=defaultInitGTProps.apiKey] - API key for the GeneralTranslation service. Required if using the default GT base URL.
 * @param {string} [devApiKey=defaultInitGTProps.devApiKey] - API key for dev environment only.
 * @param {string} [projectId=defaultInitGTProps.projectId] - Project ID for the GeneralTranslation service. Required for most functionality.
 * @param {string|null} [runtimeUrl=defaultInitGTProps.runtimeUrl] - The base URL for the GT API. Set to an empty string to disable automatic translations. Set to null to disable.
 * @param {string|null} [cacheUrl=defaultInitGTProps.cacheUrl] - The URL for cached translations. Set to null to disable.
 * @param {string[]|undefined} - Whether to use local translations.
 * @param {string[]} [locales=defaultInitGTProps.locales] - List of supported locales for the application.
 * @param {string} [defaultLocale=defaultInitGTProps.defaultLocale] - The default locale to use if none is specified.
 * @param {object} [renderSettings=defaultInitGTProps.renderSettings] - Render settings for how translations should be handled.
 * @param {number} [cacheExpiryTime=defaultInitGTProps.cacheExpiryTime] - The time in milliseconds for how long translations should be cached.
 * @param {number} [maxConcurrentRequests=defaultInitGTProps.maxConcurrentRequests] - Maximum number of concurrent requests allowed.
 * @param {number} [maxBatchSize=defaultInitGTProps.maxBatchSize] - Maximum translation requests in the same batch.
 * @param {number} [batchInterval=defaultInitGTProps.batchInterval] - The interval in milliseconds between batched translation requests.
 * @param {boolean} [ignoreBrowserLocales=defaultWithGTConfigProps.ignoreBrowserLocales] - Whether to ignore browser's preferred locales.
 * @param {object} metadata - Additional metadata that can be passed for extended configuration.
 *
 * @param {NextConfig} nextConfig - The Next.js configuration object to extend
 * @param {withGTConfigProps} props - General Translation configuration properties
 * @returns {NextConfig} - An updated Next.js config with GT settings applied
 *
 * @throws {Error} If the project ID is missing and default URLs are used, or if the API key is required and missing.
 */
function withGTConfig(nextConfig, props) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (nextConfig === void 0) { nextConfig = {}; }
    if (props === void 0) { props = {}; }
    // ---------- LOAD GT CONFIG FILE ---------- //
    var loadedConfig = {};
    var configPath = props.config || defaultWithGTConfigProps_1.default.config;
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
    var envApiKey = process.env.GT_DEV_API_KEY || process.env.GT_API_KEY;
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
    var mergedConfig = __assign(__assign(__assign(__assign(__assign({}, defaultWithGTConfigProps_1.default), loadedConfig), envConfig), props), { _usingPlugin: true });
    // ----------- RESOLVE ANY EXTERNAL FILES ----------- //
    // Resolve dictionary filepath
    var resolvedDictionaryFilePath = typeof mergedConfig.dictionary === 'string'
        ? mergedConfig.dictionary
        : resolveConfigFilepath('dictionary', ['.ts', '.js', '.json']); // fallback to dictionary
    // Check [defaultLocale].json file
    if (!resolvedDictionaryFilePath && mergedConfig.defaultLocale) {
        resolvedDictionaryFilePath = resolveConfigFilepath(mergedConfig.defaultLocale, ['.json']);
        // Check [defaultLanguageCode].json file
        if (!resolvedDictionaryFilePath) {
            var defaultLanguage = (_b = (0, generaltranslation_1.getLocaleProperties)(mergedConfig.defaultLocale)) === null || _b === void 0 ? void 0 : _b.languageCode;
            if (defaultLanguage && defaultLanguage !== mergedConfig.defaultLocale) {
                resolvedDictionaryFilePath = resolveConfigFilepath(defaultLanguage, [
                    '.json',
                ]);
            }
        }
    }
    // Get the type of dictionary file
    var resolvedDictionaryFilePathType = resolvedDictionaryFilePath
        ? path_1.default.extname(resolvedDictionaryFilePath)
        : undefined;
    if (resolvedDictionaryFilePathType) {
        mergedConfig._dictionaryFileType = resolvedDictionaryFilePathType;
    }
    // Resolve custom dictionary loader path
    var customLoadDictionaryPath = typeof mergedConfig.loadDictionaryPath === 'string'
        ? mergedConfig.loadDictionaryPath
        : resolveConfigFilepath('loadDictionary');
    // Resolve custom translation loader path
    var customLoadTranslationsPath = typeof mergedConfig.loadTranslationsPath === 'string'
        ? mergedConfig.loadTranslationsPath
        : resolveConfigFilepath('loadTranslations');
    // Resolve router
    var customRouterPath = typeof mergedConfig.routerPath === 'string'
        ? mergedConfig.routerPath
        : resolveConfigFilepath('routing', ['.ts', '.js']);
    // ----------- LOCALE STANDARDIZATION ----------- //
    // Check if using Services
    var gtRuntimeTranslationEnabled = !!(mergedConfig.runtimeUrl === defaultWithGTConfigProps_1.default.runtimeUrl &&
        ((process.env.NODE_ENV === 'production' && mergedConfig.apiKey) ||
            (process.env.NODE_ENV === 'development' && mergedConfig.devApiKey)));
    var gtRemoteCacheEnabled = !!(mergedConfig.cacheUrl === defaultWithGTConfigProps_1.default.cacheUrl &&
        mergedConfig.loadTranslationsType === 'remote');
    var gtServicesEnabled = !!((gtRuntimeTranslationEnabled || gtRemoteCacheEnabled) &&
        mergedConfig.projectId);
    // Standardize locales
    if (mergedConfig.locales && mergedConfig.defaultLocale) {
        mergedConfig.locales.unshift(mergedConfig.defaultLocale);
    }
    var updatedLocales = [];
    mergedConfig.locales = Array.from(new Set(mergedConfig.locales)).map(function (locale) {
        var updatedLocale = gtServicesEnabled
            ? (0, generaltranslation_1.standardizeLocale)(locale)
            : locale;
        if (updatedLocale !== locale) {
            updatedLocales.push("".concat(locale, " -> ").concat(updatedLocale));
        }
        return updatedLocale;
    });
    // ---------- ERROR CHECKS ---------- //
    // Local dictionary flag
    if (customLoadDictionaryPath) {
        // Check: file exists if provided
        if (!fs_1.default.existsSync(path_1.default.resolve(customLoadDictionaryPath))) {
            throw new Error((0, createErrors_1.unresolvedLoadDictionaryBuildError)(customLoadDictionaryPath));
        }
        else {
            mergedConfig.loadDictionaryEnabled = true;
        }
    }
    else {
        mergedConfig.loadDictionaryEnabled = false;
    }
    // Local translations flag
    if (customLoadTranslationsPath) {
        // Check: file exists if provided
        if (!fs_1.default.existsSync(path_1.default.resolve(customLoadTranslationsPath))) {
            throw new Error((0, createErrors_1.unresolvedLoadTranslationsBuildError)(customLoadTranslationsPath));
        }
        else {
            mergedConfig.loadTranslationsType = 'custom';
        }
    }
    else {
        mergedConfig.loadTranslationsType = 'remote';
    }
    // Check: projectId is not required for remote infrastructure, but warn if missing for dev, nothing for prod
    if ((mergedConfig.cacheUrl || mergedConfig.runtimeUrl) &&
        !mergedConfig.projectId &&
        process.env.NODE_ENV === 'development' &&
        mergedConfig.loadTranslationsType === 'remote' &&
        !mergedConfig.loadDictionaryEnabled // skip warn if using local dictionary
    ) {
        console.warn(createErrors_1.projectIdMissingWarn);
    }
    // Check: dev API key should not be included in production
    if (process.env.NODE_ENV === 'production' && mergedConfig.devApiKey) {
        throw new Error(createErrors_1.devApiKeyIncludedInProductionError);
    }
    // Check: An API key is required for runtime translation
    if (mergedConfig.projectId && // must have projectId for this check to matter anyways
        mergedConfig.runtimeUrl &&
        !(mergedConfig.apiKey || mergedConfig.devApiKey) &&
        process.env.NODE_ENV === 'development') {
        console.warn(createErrors_1.APIKeyMissingWarn);
    }
    // Check: if using GT infrastructure, warn about unsupported locales
    if (gtServicesEnabled) {
        // Warn about standardized locales
        if (updatedLocales.length) {
            console.warn((0, createErrors_1.standardizedLocalesWarning)(updatedLocales));
        }
        // Warn about unsupported locales
        var warningLocales = (mergedConfig.locales || defaultWithGTConfigProps_1.default.locales).filter(function (locale) { return !(0, supported_locales_1.getSupportedLocale)(locale); });
        if (warningLocales.length) {
            console.warn((0, createErrors_1.createUnsupportedLocalesWarning)(warningLocales));
        }
    }
    // ---------- STORE CONFIGURATIONS ---------- //
    var I18NConfigParams = JSON.stringify(mergedConfig);
    return __assign(__assign({}, nextConfig), { env: __assign(__assign(__assign(__assign({}, nextConfig.env), { _GENERALTRANSLATION_I18N_CONFIG_PARAMS: I18NConfigParams }), (resolvedDictionaryFilePathType && {
            _GENERALTRANSLATION_DICTIONARY_FILE_TYPE: resolvedDictionaryFilePathType,
        })), { _GENERALTRANSLATION_LOCAL_DICTIONARY_ENABLED: mergedConfig.loadDictionaryEnabled.toString(), _GENERALTRANSLATION_LOCAL_TRANSLATION_ENABLED: (mergedConfig.loadTranslationsType === 'custom').toString(), _GENERALTRANSLATION_DEFAULT_LOCALE: (mergedConfig.defaultLocale || defaultWithGTConfigProps_1.default.defaultLocale).toString(), _GENERALTRANSLATION_GT_SERVICES_ENABLED: gtServicesEnabled.toString(), _GENERALTRANSLATION_IGNORE_BROWSER_LOCALES: ((_c = mergedConfig.ignoreBrowserLocales) === null || _c === void 0 ? void 0 : _c.toString()) ||
                defaultWithGTConfigProps_1.default.ignoreBrowserLocales.toString() }), experimental: __assign(__assign({}, nextConfig.experimental), (process.env.TURBOPACK === '1' || ((_d = nextConfig.experimental) === null || _d === void 0 ? void 0 : _d.turbo)
            ? {
                turbo: __assign(__assign({}, (((_e = nextConfig.experimental) === null || _e === void 0 ? void 0 : _e.turbo) || {})), { resolveAlias: __assign(__assign({}, (((_g = (_f = nextConfig.experimental) === null || _f === void 0 ? void 0 : _f.turbo) === null || _g === void 0 ? void 0 : _g.resolveAlias) || {})), { 'gt-next/_dictionary': resolvedDictionaryFilePath || '', 'gt-next/_load-translations': customLoadTranslationsPath || '', 'gt-next/_load-dictionary': customLoadDictionaryPath || '', 'gt-next/_routing': customRouterPath || '' }) }),
            }
            : {})), webpack: function webpack() {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var webpackConfig = _a[0], options = _a[1];
            // Only apply webpack aliases if we're using webpack (not Turbopack)
            var isTurbopack = (options === null || options === void 0 ? void 0 : options.turbo) || process.env.TURBOPACK === '1';
            if (!isTurbopack) {
                // Disable cache in dev bc people might move around loadTranslations() and loadDictionary() files
                if (process.env.NODE_ENV === 'development') {
                    webpackConfig.cache = false;
                }
                if (resolvedDictionaryFilePath) {
                    webpackConfig.resolve.alias['gt-next/_dictionary'] = path_1.default.resolve(webpackConfig.context, resolvedDictionaryFilePath);
                }
                if (customLoadTranslationsPath) {
                    webpackConfig.resolve.alias["gt-next/_load-translations"] =
                        path_1.default.resolve(webpackConfig.context, customLoadTranslationsPath);
                }
                if (customLoadDictionaryPath) {
                    webpackConfig.resolve.alias["gt-next/_load-dictionary"] =
                        path_1.default.resolve(webpackConfig.context, customLoadDictionaryPath);
                }
                if (customLoadDictionaryPath) {
                    webpackConfig.resolve.alias["gt-next/_routing"] = path_1.default.resolve(webpackConfig.context, customLoadDictionaryPath);
                }
            }
            if (typeof (nextConfig === null || nextConfig === void 0 ? void 0 : nextConfig.webpack) === 'function') {
                return nextConfig.webpack(webpackConfig, options);
            }
            return webpackConfig;
        } });
}
// Keep initGT for backward compatibility
var initGT = function (props) { return function (nextConfig) {
    return withGTConfig(nextConfig, props);
}; };
exports.initGT = initGT;
/**
 * Resolves a configuration filepath for dictionary files.
 *
 * @param {string} fileName - The base name of the config file to look for.
 * @param {string} [cwd] - An optional current working directory path.
 * @returns {string|undefined} - The path if found; otherwise undefined.
 */
function resolveConfigFilepath(fileName, extensions, cwd) {
    if (extensions === void 0) { extensions = ['.ts', '.js']; }
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
    for (var _i = 0, _a = __spreadArray(__spreadArray([], extensions.map(function (ext) { return "./".concat(fileName).concat(ext); }), true), extensions.map(function (ext) { return "./src/".concat(fileName).concat(ext); }), true); _i < _a.length; _i++) {
        var candidate = _a[_i];
        if (pathExists(candidate)) {
            return candidate;
        }
    }
    // Return undefined if no file is found
    return undefined;
}
//# sourceMappingURL=config.js.map