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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
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
var internal_1 = require("gt-react/internal");
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
 * @param {string} [runtimeUrl=defaultInitGTProps.runtimeUrl] - The base URL for the GT API. Set to an empty string to disable automatic translations.
 * @param {string} [cacheUrl=defaultInitGTProps.cacheUrl] - The URL for cached translations.
 * @param {number} [cacheExpiryTime=defaultInitGTProps.cacheExpiryTime] - How long to cache translations in memory (milliseconds).
 * @param {boolean} [runtimeTranslation=defaultInitGTProps.runtimeTranslation] - Whether to enable runtime translation.
 * @param {boolean} [remoteCache=defaultInitGTProps.remoteCache] - Whether to enable remote caching of translations.
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
function initGT(_a) {
    var _b, _c;
    if (_a === void 0) { _a = defaultInitGTProps_1.default; }
    var _d = _a.config, config = _d === void 0 ? './gt.config.json' : _d, i18n = _a.i18n, dictionary = _a.dictionary, _e = _a.runtimeTranslation, runtimeTranslation = _e === void 0 ? defaultInitGTProps_1.default.runtimeTranslation : _e, _f = _a.remoteCache, remoteCache = _f === void 0 ? defaultInitGTProps_1.default.remoteCache : _f, _g = _a.apiKey, apiKey = _g === void 0 ? defaultInitGTProps_1.default.apiKey : _g, devApiKey = _a.devApiKey, _h = _a.projectId, projectId = _h === void 0 ? defaultInitGTProps_1.default.projectId : _h, _j = _a.runtimeUrl, runtimeUrl = _j === void 0 ? defaultInitGTProps_1.default.runtimeUrl : _j, _k = _a.cacheUrl, cacheUrl = _k === void 0 ? defaultInitGTProps_1.default.cacheUrl : _k, _l = _a.cacheExpiryTime, cacheExpiryTime = _l === void 0 ? defaultInitGTProps_1.default.cacheExpiryTime : _l, _m = _a.locales, locales = _m === void 0 ? defaultInitGTProps_1.default.locales : _m, _o = _a.defaultLocale, defaultLocale = _o === void 0 ? defaultInitGTProps_1.default.defaultLocale : _o, renderSettings = _a.renderSettings, _p = _a.maxConcurrentRequests, maxConcurrentRequests = _p === void 0 ? defaultInitGTProps_1.default.maxConcurrentRequests : _p, _q = _a.maxBatchSize, maxBatchSize = _q === void 0 ? defaultInitGTProps_1.default.maxBatchSize : _q, _r = _a.batchInterval, batchInterval = _r === void 0 ? defaultInitGTProps_1.default.batchInterval : _r, metadata = __rest(_a, ["config", "i18n", "dictionary", "runtimeTranslation", "remoteCache", "apiKey", "devApiKey", "projectId", "runtimeUrl", "cacheUrl", "cacheExpiryTime", "locales", "defaultLocale", "renderSettings", "maxConcurrentRequests", "maxBatchSize", "batchInterval"]);
    // Load from config file if it's a string and exists
    var loadedConfig = {};
    try {
        if (typeof config === 'string' && fs_1.default.existsSync(config)) {
            var fileContent = fs_1.default.readFileSync(config, 'utf-8');
            loadedConfig = JSON.parse(fileContent);
        }
        if (((_b = loadedConfig.locales) === null || _b === void 0 ? void 0 : _b.length) === 0) {
            loadedConfig.locales = locales;
        }
    }
    catch (error) {
        console.error('Error reading GT config file:', error);
    }
    var _renderSettings = renderSettings || internal_1.defaultRenderSettings;
    if ((renderSettings === null || renderSettings === void 0 ? void 0 : renderSettings.method) === "subtle" && devApiKey) {
        console.warn('Subtle render method cannot be used in dev environments, falling back to default.');
        _renderSettings.method = "default";
    }
    // Merge loaded file config, default props, and function args
    var mergedConfig = __assign(__assign(__assign({}, defaultInitGTProps_1.default), loadedConfig), __assign({ i18n: i18n, dictionary: dictionary, runtimeTranslation: runtimeTranslation, remoteCache: remoteCache, apiKey: apiKey, devApiKey: devApiKey, projectId: projectId, runtimeUrl: runtimeUrl, cacheUrl: cacheUrl, cacheExpiryTime: cacheExpiryTime, locales: locales, defaultLocale: defaultLocale, renderSettings: _renderSettings, maxConcurrentRequests: maxConcurrentRequests, maxBatchSize: maxBatchSize, batchInterval: batchInterval }, metadata));
    // Destructure final config
    var finalI18n = mergedConfig.i18n, finalDictionary = mergedConfig.dictionary, finalRuntimeTranslation = mergedConfig.runtimeTranslation, finalRemoteCache = mergedConfig.remoteCache, finalApiKey = mergedConfig.apiKey, finalDevApiKey = mergedConfig.devApiKey, finalProjectId = mergedConfig.projectId, finalRuntimeUrl = mergedConfig.runtimeUrl, finalCacheUrl = mergedConfig.cacheUrl, finalCacheExpiryTime = mergedConfig.cacheExpiryTime, finalLocales = mergedConfig.locales, finalDefaultLocale = mergedConfig.defaultLocale, finalRenderSettings = mergedConfig.renderSettings, finalMaxConcurrentRequests = mergedConfig.maxConcurrentRequests, finalMaxBatchSize = mergedConfig.maxBatchSize, finalBatchInterval = mergedConfig.batchInterval, restMetadata = __rest(mergedConfig, ["i18n", "dictionary", "runtimeTranslation", "remoteCache", "apiKey", "devApiKey", "projectId", "runtimeUrl", "cacheUrl", "cacheExpiryTime", "locales", "defaultLocale", "renderSettings", "maxConcurrentRequests", "maxBatchSize", "batchInterval"]);
    // ----- ERROR CHECKS ----- //
    if (finalRuntimeTranslation || finalRemoteCache) {
        if (!finalProjectId) {
            console.error(createErrors_1.projectIdMissingError);
        }
    }
    var envApiKey = process.env.GT_API_KEY || '';
    var apiKeyType = (_c = envApiKey.split('-')) === null || _c === void 0 ? void 0 : _c[1];
    var resolvedApiKey = finalApiKey;
    var resolvedDevApiKey = finalDevApiKey;
    if (apiKeyType === 'api') {
        resolvedApiKey = envApiKey;
    }
    else if (apiKeyType === 'dev') {
        resolvedDevApiKey = envApiKey;
    }
    if (finalRuntimeTranslation && !resolvedApiKey && !resolvedDevApiKey) {
        console.error(createErrors_1.APIKeyMissingError);
    }
    if (finalRuntimeUrl === defaultInitGTProps_1.default.runtimeUrl ||
        finalCacheUrl === defaultInitGTProps_1.default.cacheUrl) {
        var warningLocales = (finalLocales || defaultInitGTProps_1.default.locales).filter(function (locale) { return !(0, supported_locales_1.getSupportedLocale)(locale); });
        if (warningLocales.length)
            console.warn((0, createErrors_1.createUnsupportedLocalesWarning)(warningLocales));
    }
    // Store config params in environment variable to allow for global access (in some cases)
    var I18NConfigParams = JSON.stringify(__assign({ remoteCache: finalRemoteCache, runtimeTranslation: finalRuntimeTranslation, apiKey: resolvedApiKey, devApiKey: resolvedDevApiKey, projectId: finalProjectId, runtimeUrl: finalRuntimeUrl, cacheUrl: finalCacheUrl, cacheExpiryTime: finalCacheExpiryTime, locales: finalLocales, defaultLocale: finalDefaultLocale, renderSettings: finalRenderSettings, maxConcurrentRequests: finalMaxConcurrentRequests, maxBatchSize: finalMaxBatchSize, batchInterval: finalBatchInterval }, restMetadata));
    // Resolve i18n and dictionary paths
    var resolvedI18NFilePath = typeof finalI18n === 'string' ? finalI18n : resolveConfigFilepath('i18n');
    var resolvedDictionaryFilePath = typeof finalDictionary === 'string'
        ? finalDictionary
        : resolveConfigFilepath('dictionary');
    return function (nextConfig) {
        if (nextConfig === void 0) { nextConfig = {}; }
        return __assign(__assign({}, nextConfig), { env: __assign(__assign({}, nextConfig.env), { _GENERALTRANSLATION_I18N_CONFIG_PARAMS: I18NConfigParams }), webpack: function webpack() {
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