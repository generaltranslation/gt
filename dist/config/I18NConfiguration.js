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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var generaltranslation_1 = __importStar(require("generaltranslation"));
var RemoteTranslationsManager_1 = __importDefault(require("./RemoteTranslationsManager"));
var defaultInitGTProps_1 = __importDefault(require("./props/defaultInitGTProps"));
var internal_1 = require("gt-react/internal");
var I18NConfiguration = /** @class */ (function () {
    function I18NConfiguration(_a) {
        var 
        // Cloud integration
        apiKey = _a.apiKey, projectId = _a.projectId, baseURL = _a.baseURL, cacheURL = _a.cacheURL, 
        // Locale info
        defaultLocale = _a.defaultLocale, locales = _a.locales, 
        // Render method
        renderSettings = _a.renderSettings, 
        // Dictionaries
        dictionary = _a.dictionary, 
        // Batching config
        maxConcurrentRequests = _a.maxConcurrentRequests, batchInterval = _a.batchInterval, 
        // Environment
        env = _a.env, 
        // Other metadata
        metadata = __rest(_a, ["apiKey", "projectId", "baseURL", "cacheURL", "defaultLocale", "locales", "renderSettings", "dictionary", "maxConcurrentRequests", "batchInterval", "env"]);
        // Cloud integration
        this.projectId = projectId;
        this.baseURL = baseURL;
        // Locales
        this.defaultLocale = defaultLocale;
        this.locales = locales;
        // Render method
        this.renderSettings = renderSettings;
        // GT
        this.gt = new generaltranslation_1.default({
            projectId: projectId,
            apiKey: apiKey,
            defaultLocale: defaultLocale,
            baseURL: baseURL,
        });
        // Default env is production
        this.env = env || "production";
        // Other metadata
        this.metadata = __assign(__assign(__assign({ env: this.env, defaultLocale: this.defaultLocale }, (this.renderSettings.timeout && {
            timeout: this.renderSettings.timeout - batchInterval,
        })), { projectId: this.projectId }), metadata);
        // Dictionary managers
        if (cacheURL && projectId) {
            this._remoteTranslationsManager = RemoteTranslationsManager_1.default;
            this._remoteTranslationsManager.setConfig({
                cacheURL: cacheURL,
                projectId: projectId,
            });
        }
        // Cache of hashes to speed up <GTProvider>
        this._taggedDictionary = new Map();
        this._template = new Map();
        // Batching
        this.maxConcurrentRequests = maxConcurrentRequests;
        this.batchInterval = batchInterval;
        this._queue = [];
        this._activeRequests = 0;
        this._translationCache = new Map(); // cache for ongoing promises, so things aren't translated twice
        this._startBatching();
    }
    /**
     * Gets the application's default locale
     * @returns {string} A BCP-47 locale tag
     */
    I18NConfiguration.prototype.getDefaultLocale = function () {
        return this.defaultLocale;
    };
    /**
     * Gets the list of approved locales for this app
     * @returns {string[] | undefined} A list of BCP-47 locale tags, or undefined if none were provided
     */
    I18NConfiguration.prototype.getLocales = function () {
        return this.locales;
    };
    /**
     * @returns A boolean indicating whether automatic translation is enabled or disabled for this config
     */
    I18NConfiguration.prototype.translationEnabled = function () {
        return this.baseURL &&
            this.projectId &&
            (this.baseURL === defaultInitGTProps_1.default.baseURL ? this.gt.apiKey : true)
            ? true
            : false;
    };
    /**
     * Get the rendering instructions
     * @returns An object containing the current method and timeout.
     * As of 7/31/24: method is "skeleton", "replace", "hang", "subtle".
     * Timeout is a number or null, representing no assigned timeout.
     */
    I18NConfiguration.prototype.getRenderSettings = function () {
        return this.renderSettings;
    };
    /**
     * Check if translation is required based on the user's locale
     * @param locale - The user's locale
     * @returns True if translation is required, otherwise false
     */
    I18NConfiguration.prototype.requiresTranslation = function (locale) {
        return (this.translationEnabled() &&
            (0, generaltranslation_1.requiresTranslation)(this.defaultLocale, locale, this.locales));
    };
    I18NConfiguration.prototype.addGTIdentifier = function (children, id) {
        // In development, recompute every time
        if (this.env === "development" || !id) {
            return (0, internal_1.addGTIdentifier)(children, id);
        }
        // In production, since dictionary content isn't changing, cache results
        var taggedDictionaryEntry = this._taggedDictionary.get(id);
        if (taggedDictionaryEntry) {
            return taggedDictionaryEntry;
        }
        var taggedChildren = (0, internal_1.addGTIdentifier)(children, id);
        this._taggedDictionary.set(id, taggedChildren);
        return taggedChildren;
    };
    /**
     * @returns {[any, string]} A xxhash hash and the children that were created from it
    */
    I18NConfiguration.prototype.serializeAndHash = function (children, context, id) {
        // In development, recomputes hashes each time
        if (this.env === "development" || !id) {
            var childrenAsObjects_1 = (0, internal_1.writeChildrenAsObjects)(children);
            return [
                childrenAsObjects_1,
                (0, internal_1.hashReactChildrenObjects)(context ? [childrenAsObjects_1, context] : childrenAsObjects_1)
            ];
        }
        // In production, since dictionary content isn't changing, cache results
        var templateEntry = this._template.get(id);
        if (templateEntry) {
            return [templateEntry.t, templateEntry.k];
        }
        var childrenAsObjects = (0, internal_1.writeChildrenAsObjects)(children);
        var hash = (0, internal_1.hashReactChildrenObjects)(context ? [childrenAsObjects, context] : childrenAsObjects);
        this._template.set(id, { k: hash, t: childrenAsObjects });
        return [childrenAsObjects, hash];
    };
    /**
     * Get the translation dictionaries for this user's locale, if they exist
     * Globally shared cache
     * @param locale - The locale set by the user
     * @returns A promise that resolves to the translations.
     */
    I18NConfiguration.prototype.getTranslations = function (locale) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, ((_a = this._remoteTranslationsManager) === null || _a === void 0 ? void 0 : _a.getTranslations(locale))];
                    case 1: return [2 /*return*/, ((_b.sent()) || {})];
                }
            });
        });
    };
    /**
     * Translate content into language associated with a given locale
     * @param params - Parameters for translation
     * @returns Translated string
     */
    I18NConfiguration.prototype.translate = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, content, targetLocale, options, translationPromise;
            var _this = this;
            return __generator(this, function (_a) {
                cacheKey = constructCacheKey(params.targetLocale, params.options);
                if (this._translationCache.has(cacheKey)) {
                    return [2 /*return*/, this._translationCache.get(cacheKey)];
                }
                content = params.content, targetLocale = params.targetLocale, options = params.options;
                translationPromise = new Promise(function (resolve, reject) {
                    _this._queue.push({
                        type: 'string',
                        data: {
                            content: content,
                            targetLocale: targetLocale,
                            metadata: __assign(__assign(__assign({}, _this.metadata), { projectId: _this.projectId }), options),
                        },
                        revalidate: _this.env !== "development" && (_this._remoteTranslationsManager
                            ? _this._remoteTranslationsManager.getTranslationRequested(targetLocale)
                            : false),
                        resolve: resolve,
                        reject: reject,
                    });
                }).catch(function (error) {
                    _this._translationCache.delete(cacheKey);
                    console.error(error);
                    return '';
                });
                this._translationCache.set(cacheKey, translationPromise);
                return [2 /*return*/, translationPromise];
            });
        });
    };
    /**
     * Translate the children components
     * @param params - Parameters for translation
     * @returns A promise that resolves when translation is complete
     */
    I18NConfiguration.prototype.translateChildren = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, children, targetLocale, metadata, translationPromise;
            var _this = this;
            return __generator(this, function (_a) {
                cacheKey = constructCacheKey(params.targetLocale, params.metadata);
                // In memory cache to make sure the same translation isn't requested twice
                if (this._translationCache.has(cacheKey)) {
                    // Returns the previous request
                    return [2 /*return*/, this._translationCache.get(cacheKey)];
                }
                children = params.children, targetLocale = params.targetLocale, metadata = params.metadata;
                translationPromise = new Promise(function (resolve, reject) {
                    // In memory queue to batch requests
                    _this._queue.push({
                        type: 'react',
                        data: {
                            children: children,
                            targetLocale: targetLocale,
                            metadata: __assign(__assign({}, _this.metadata), metadata),
                        },
                        revalidate: _this.env !== "development" && (_this._remoteTranslationsManager
                            ? _this._remoteTranslationsManager.getTranslationRequested(targetLocale)
                            : false),
                        resolve: resolve,
                        reject: reject,
                    });
                }).catch(function (error) {
                    _this._translationCache.delete(cacheKey);
                    console.error(error);
                    return null;
                });
                this._translationCache.set(cacheKey, translationPromise);
                return [2 /*return*/, translationPromise];
            });
        });
    };
    /**
     * Send a batch request for React translation
     * @param batch - The batch of requests to be sent
     */
    I18NConfiguration.prototype._sendBatchRequest = function (batch) {
        return __awaiter(this, void 0, void 0, function () {
            var batchPromise, results_1, error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._activeRequests++;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        batchPromise = this.gt.translateBatch(batch);
                        batch.forEach(function (item) {
                            if (_this._remoteTranslationsManager && !item.revalidate)
                                _this._remoteTranslationsManager.setTranslationRequested(item.data.targetLocale);
                        });
                        return [4 /*yield*/, batchPromise];
                    case 2:
                        results_1 = _a.sent();
                        batch.forEach(function (item, index) {
                            var result = results_1[index];
                            if (!result)
                                return item.reject('Translation failed.');
                            if (result && typeof result === 'object') {
                                item.resolve(result.translation);
                                if (result.translation &&
                                    result.locale &&
                                    result.reference &&
                                    _this._remoteTranslationsManager) {
                                    _this._remoteTranslationsManager.setTranslations(result.locale, result.reference.key, result.reference.id, result.translation);
                                }
                            }
                        });
                        return [3 /*break*/, 5];
                    case 3:
                        error_1 = _a.sent();
                        console.error(error_1);
                        batch.forEach(function (item) {
                            item.reject();
                        });
                        return [3 /*break*/, 5];
                    case 4:
                        this._activeRequests--;
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Start the batching process with a set interval
     */
    I18NConfiguration.prototype._startBatching = function () {
        var _this = this;
        setInterval(function () {
            if (_this._queue.length > 0 &&
                _this._activeRequests < _this.maxConcurrentRequests) {
                _this._sendBatchRequest(_this._queue);
                _this._queue = [];
            }
        }, this.batchInterval);
    };
    return I18NConfiguration;
}());
exports.default = I18NConfiguration;
// Constructs the unique identification key for the map which is the in-memory same-render-cycle cache
var constructCacheKey = function (targetLocale, metadata) {
    return "".concat(targetLocale, "-").concat(metadata.hash);
};
//# sourceMappingURL=I18NConfiguration.js.map