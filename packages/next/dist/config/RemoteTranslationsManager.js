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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteTranslationsManager = void 0;
var generaltranslation_1 = require("generaltranslation");
var createErrors_1 = require("../errors/createErrors");
var defaultInitGTProps_1 = __importDefault(require("./props/defaultInitGTProps"));
var internal_1 = require("generaltranslation/internal");
/**
 * Manages remote translations.
 */
var RemoteTranslationsManager = /** @class */ (function () {
    /**
     * Creates an instance of RemoteTranslationsManager.
     * @constructor
     */
    function RemoteTranslationsManager() {
        this.config = {
            cacheUrl: internal_1.defaultCacheUrl,
            projectId: '',
            cacheExpiryTime: defaultInitGTProps_1.default.cacheExpiryTime, // default to 60 seconds
            _versionId: undefined,
            localTranslation: false,
            remoteCache: true,
        };
        this.translationsMap = new Map();
        this.fetchPromises = new Map();
        this.requestedTranslations = new Map();
        this.lastFetchTime = new Map();
    }
    /**
     * Sets the configuration for the RemoteTranslationsManager.
     * @param {Partial<RemoteTranslationsConfig>} newConfig - The new configuration to apply.
     */
    RemoteTranslationsManager.prototype.setConfig = function (newConfig) {
        this.config = __assign(__assign({}, this.config), newConfig);
    };
    /**
     * Fetches translations from the remote cache.
     * @param {string} reference - The translation reference.
     * @returns {Promise<TranslationsObject | undefined>} The fetched translations or null if not found.
     */
    RemoteTranslationsManager.prototype._fetchTranslations = function (reference) {
        return __awaiter(this, void 0, void 0, function () {
            var sourceConfig, getLocalTranslation, txSource, parsedResult, error_1, response, result, parsedResult, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 7, , 8]);
                        if (!this.config.localTranslation) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        sourceConfig = require('gt-next/_config');
                        getLocalTranslation = sourceConfig.default;
                        return [4 /*yield*/, getLocalTranslation(reference)];
                    case 2:
                        txSource = _a.sent();
                        if (txSource && Object.keys(txSource).length) {
                            // Record our fetch time
                            this.lastFetchTime.set(reference, Date.now());
                            parsedResult = Object.entries(txSource).reduce(function (translationsAcc, _a) {
                                var key = _a[0], target = _a[1];
                                translationsAcc[key] = { state: 'success', target: target };
                                return translationsAcc;
                            }, {});
                            console.log('parsedResult', parsedResult);
                            return [2 /*return*/, parsedResult];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error(createErrors_1.localTranslationsError, error_1);
                        return [3 /*break*/, 4];
                    case 4:
                        // ----- REMOTE TRANSLATIONS ----- //
                        if (!this.config.remoteCache) {
                            return [2 /*return*/, undefined];
                        }
                        return [4 /*yield*/, fetch("".concat(this.config.cacheUrl, "/").concat(this.config.projectId, "/").concat(reference).concat(this.config._versionId ? "/".concat(this.config._versionId) : ''))];
                    case 5:
                        response = _a.sent();
                        return [4 /*yield*/, response.json()];
                    case 6:
                        result = _a.sent();
                        if (Object.keys(result).length) {
                            // Record our fetch time
                            this.lastFetchTime.set(reference, Date.now());
                            parsedResult = Object.entries(result).reduce(function (translationsAcc, _a) {
                                var key = _a[0], target = _a[1];
                                translationsAcc[key] = { state: 'success', target: target };
                                return translationsAcc;
                            }, {});
                            return [2 /*return*/, parsedResult];
                        }
                        return [3 /*break*/, 8];
                    case 7:
                        error_2 = _a.sent();
                        console.error(createErrors_1.remoteTranslationsError, error_2);
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/, undefined];
                }
            });
        });
    };
    /**
     * Checks if translations are expired based on the configured TTL.
     * @param {string} reference - The translation reference.
     * @returns {boolean} True if expired, false otherwise.
     */
    RemoteTranslationsManager.prototype._isExpired = function (reference) {
        var _a;
        var fetchTime = this.lastFetchTime.get(reference);
        if (!fetchTime)
            return true;
        var now = Date.now();
        var expiryTime = (_a = this.config.cacheExpiryTime) !== null && _a !== void 0 ? _a : defaultInitGTProps_1.default.cacheExpiryTime;
        return now - fetchTime > expiryTime;
    };
    /**
     * Retrieves translations for a given locale from the remote or local cache.
     * @param {string} locale - The locale code.
     * @returns {Promise<TranslationsObject | undefined>} The translations data or null if not found.
     */
    RemoteTranslationsManager.prototype.getCachedTranslations = function (locale) {
        return __awaiter(this, void 0, void 0, function () {
            var reference, fetchPromise, retrievedTranslations;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        reference = (0, generaltranslation_1.standardizeLocale)(locale);
                        // If we have cached translations locally and they are not expired, return them
                        if (this.translationsMap.has(reference) && !this._isExpired(reference)) {
                            return [2 /*return*/, this.translationsMap.get(reference)];
                        }
                        if (!this.fetchPromises.has(reference)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.fetchPromises.get(reference)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        fetchPromise = this._fetchTranslations(reference);
                        this.fetchPromises.set(reference, fetchPromise);
                        return [4 /*yield*/, fetchPromise];
                    case 3:
                        retrievedTranslations = _a.sent();
                        this.fetchPromises.delete(reference);
                        // Populate our record of translations
                        if (retrievedTranslations) {
                            this.translationsMap.set(reference, retrievedTranslations);
                        }
                        return [2 /*return*/, retrievedTranslations];
                }
            });
        });
    };
    /**
     * Sets a new translation entry.
     * @param {string} locale - The locale code.
     * @param {string} hash - The key for the new entry.
     * @param {string} [id=hash] - The id for the new entry, defaults to key if not provided.
     * @param {any} translation - The translation value.
     * @param {boolean} [isRuntimeTranslation=true] - Whether the translation was a runtime translation.
     * @returns {boolean} True if the entry was set successfully, false otherwise.
     */
    RemoteTranslationsManager.prototype.setTranslations = function (locale, hash, id, translation, isRuntimeTranslation) {
        var _a;
        if (id === void 0) { id = hash; }
        if (isRuntimeTranslation === void 0) { isRuntimeTranslation = true; }
        if (!(locale && hash && translation))
            return false;
        var reference = (0, generaltranslation_1.standardizeLocale)(locale);
        var currentTranslations = this.translationsMap.get(reference) || {};
        var key = isRuntimeTranslation ? hash : id;
        this.translationsMap.set(reference, __assign(__assign({}, currentTranslations), (_a = {}, _a[key] = translation, _a)));
        // Reset the fetch time since we just manually updated the translation
        this.lastFetchTime.set(reference, Date.now());
        return true;
    };
    /**
     * Marks translations as requested for a given locale.
     * @param {string} locale - The locale code.
     */
    RemoteTranslationsManager.prototype.setTranslationRequested = function (locale) {
        var reference = (0, generaltranslation_1.standardizeLocale)(locale);
        this.requestedTranslations.set(reference, true);
    };
    /**
     * Checks if translations have been requested for a given locale.
     * @param {string} locale - The locale code.
     * @returns {boolean} True if requested, false otherwise.
     */
    RemoteTranslationsManager.prototype.getTranslationRequested = function (locale) {
        var reference = (0, generaltranslation_1.standardizeLocale)(locale);
        return this.requestedTranslations.get(reference) ? true : false;
    };
    return RemoteTranslationsManager;
}());
exports.RemoteTranslationsManager = RemoteTranslationsManager;
var remoteTranslationsManager = new RemoteTranslationsManager();
exports.default = remoteTranslationsManager;
//# sourceMappingURL=RemoteTranslationsManager.js.map