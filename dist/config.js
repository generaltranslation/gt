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
 * @param {string|undefined} i18n - Optional i18n configuration file path. If a string is provided, it will be used as a path.
 * @param {string|undefined} dictionary - Optional dictionary configuration file path. If a string is provided, it will be used as a path.
 * @param {string} [apiKey=defaultInitGTProps.apiKey] - API key for the GeneralTranslation service. Required if using the default GT base URL.
 * @param {string} [projectId=defaultInitGTProps.projectId] - Project ID for the GeneralTranslation service. Required for most functionality.
 * @param {string} [baseUrl=defaultInitGTProps.baseUrl] - The base URL for the GT API. Set to an empty string to disable automatic translations.
 * @param {string} [clientBaseUrl=defaultInitGTProps.clientBaseUrl] - The client base URL for the GT API. Set to an empty string to disable automatic translations.
 * @param {string} [cacheUrl=defaultInitGTProps.cacheUrl] - The URL for cached translations.
 * @param {string[]} [locales] - List of supported locales for the application. Defaults to the first locale or the default locale if not provided.
 * @param {string} [defaultLocale=defaultInitGTProps.defaultLocale] - The default locale to use if none is specified.
 * @param {object} [renderSettings=defaultInitGTProps.renderSettings] - Render settings for how translations should be handled.
 * @param {number} [_maxConcurrentRequests=defaultInitGTProps._maxConcurrectRequests] - Maximum number of concurrent requests allowed.
 * @param {number} [_maxBatchSize=defaultInitGTProps._maxBatchSize] - Maximum translation requests in the same batch.
 * @param {number} [_batchInterval=defaultInitGTProps._batchInterval] - The interval in milliseconds between batched translation requests.
 * @param {object} metadata - Additional metadata that can be passed for extended configuration.
 *
 * @returns {function(NextConfig): NextConfig} - A function that accepts a Next.js config object and returns an updated config with GT settings applied.
 *
 * @throws {Error} If the project ID is missing and default URLs are used, or if the API key is required and missing.
 *
 */
function initGT(_a) {
    var _b;
    if (_a === void 0) { _a = defaultInitGTProps_1.default; }
    var i18n = _a.i18n, dictionary = _a.dictionary, _c = _a.apiKey, apiKey = _c === void 0 ? defaultInitGTProps_1.default.apiKey : _c, _d = _a.devApiKey, devApiKey = _d === void 0 ? defaultInitGTProps_1.default.devApiKey : _d, _e = _a.projectId, projectId = _e === void 0 ? defaultInitGTProps_1.default.projectId : _e, _f = _a.baseUrl, baseUrl = _f === void 0 ? defaultInitGTProps_1.default.baseUrl : _f, _g = _a.clientBaseUrl, clientBaseUrl = _g === void 0 ? defaultInitGTProps_1.default.clientBaseUrl : _g, _h = _a.cacheUrl, cacheUrl = _h === void 0 ? defaultInitGTProps_1.default.cacheUrl : _h, _j = _a.cacheExpiryTime, cacheExpiryTime = _j === void 0 ? defaultInitGTProps_1.default.cacheExpiryTime : _j, _k = _a.locales, locales = _k === void 0 ? defaultInitGTProps_1.default.locales : _k, _l = _a.defaultLocale, defaultLocale = _l === void 0 ? defaultInitGTProps_1.default.defaultLocale : _l, _m = _a.renderSettings, renderSettings = _m === void 0 ? internal_1.defaultRenderSettings : _m, _o = _a.env, env = _o === void 0 ? defaultInitGTProps_1.default.env : _o, _p = _a._maxConcurrentRequests, _maxConcurrentRequests = _p === void 0 ? defaultInitGTProps_1.default._maxConcurrectRequests : _p, _q = _a._maxBatchSize, _maxBatchSize = _q === void 0 ? defaultInitGTProps_1.default._maxBatchSize : _q, _r = _a._batchInterval, _batchInterval = _r === void 0 ? defaultInitGTProps_1.default._batchInterval : _r, metadata = __rest(_a, ["i18n", "dictionary", "apiKey", "devApiKey", "projectId", "baseUrl", "clientBaseUrl", "cacheUrl", "cacheExpiryTime", "locales", "defaultLocale", "renderSettings", "env", "_maxConcurrentRequests", "_maxBatchSize", "_batchInterval"]);
    // Error checks
    if (!projectId &&
        (cacheUrl === defaultInitGTProps_1.default.cacheUrl ||
            baseUrl === defaultInitGTProps_1.default.baseUrl ||
            clientBaseUrl === defaultInitGTProps_1.default.clientBaseUrl))
        console.error(createErrors_1.projectIdMissingError);
    if ((!apiKey || !projectId)
        && baseUrl === defaultInitGTProps_1.default.baseUrl
        && clientBaseUrl === defaultInitGTProps_1.default.clientBaseUrl) {
        console.error(createErrors_1.APIKeyMissingError);
    }
    var envApiKey = process.env.GT_API_KEY || '';
    var apiKeyType = (_b = envApiKey === null || envApiKey === void 0 ? void 0 : envApiKey.split('-')) === null || _b === void 0 ? void 0 : _b[1];
    if (apiKeyType === "api") {
        apiKey = envApiKey;
    }
    else if (apiKeyType === "dev") {
        devApiKey = envApiKey;
    }
    if (!apiKey && !devApiKey)
        console.error(createErrors_1.APIKeyMissingError);
    if (baseUrl === defaultInitGTProps_1.default.baseUrl && clientBaseUrl === defaultInitGTProps_1.default.clientBaseUrl) {
        var warningLocales = locales.filter(function (locale) { return !(0, supported_locales_1.getSupportedLocale)(locale); });
        if (warningLocales.length)
            console.warn((0, createErrors_1.createUnsupportedLocalesWarning)(warningLocales));
    }
    // Store config params in environment variable to allow for global access (in some cases)
    var I18NConfigParams = JSON.stringify(__assign({ apiKey: apiKey, devApiKey: devApiKey, projectId: projectId, baseUrl: baseUrl, clientBaseUrl: clientBaseUrl, cacheUrl: cacheUrl, cacheExpiryTime: cacheExpiryTime, locales: locales, defaultLocale: defaultLocale, renderSettings: renderSettings, env: env, maxConcurrentRequests: _maxConcurrentRequests, maxBatchSize: _maxBatchSize, batchInterval: _batchInterval }, metadata));
    // Use i18n and dictionary values as file paths if they are provided as such
    var resolvedI18NFilePath = typeof i18n === 'string' ? i18n : resolveConfigFilepath('i18n');
    var resolvedDictionaryFilePath = typeof dictionary === 'string'
        ? dictionary
        : resolveConfigFilepath('dictionary');
    return function (config) {
        if (config === void 0) { config = {}; }
        return __assign(__assign({}, config), { env: __assign(__assign({}, config.env), { _GENERALTRANSLATION_I18N_CONFIG_PARAMS: I18NConfigParams }), webpack: function webpack() {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var webpackConfig = _a[0], options = _a[1];
                if (resolvedI18NFilePath) {
                    // Add alias for importing request handler
                    webpackConfig.resolve.alias['gt-next/_request'] = path_1.default.resolve(webpackConfig.context, resolvedI18NFilePath);
                }
                if (resolvedDictionaryFilePath) {
                    // Add alias for importing dictionary via webpack
                    webpackConfig.resolve.alias['gt-next/_dictionary'] = path_1.default.resolve(webpackConfig.context, resolvedDictionaryFilePath);
                }
                if (typeof (config === null || config === void 0 ? void 0 : config.webpack) === 'function') {
                    return config.webpack(webpackConfig, options);
                }
                return webpackConfig;
            } });
    };
}
// Function to search for both i18n.js and dictionary.js
function resolveConfigFilepath(fileName, cwd) {
    function resolvePath(pathname) {
        var parts = [];
        if (cwd)
            parts.push(cwd);
        parts.push(pathname);
        return path_1.default.resolve.apply(path_1.default, parts);
    }
    function pathExists(pathname) {
        return require('fs').existsSync(resolvePath(pathname));
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
// Helper function to handle multiple extensions
function withExtensions(localPath) {
    return [
        "".concat(localPath, ".ts"),
        "".concat(localPath, ".tsx"),
        "".concat(localPath, ".js"),
        "".concat(localPath, ".jsx"),
    ];
}
//# sourceMappingURL=config.js.map