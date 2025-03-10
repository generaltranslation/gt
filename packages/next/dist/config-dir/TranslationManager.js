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
exports.TranslationManager = void 0;
var generaltranslation_1 = require("generaltranslation");
var defaultInitGTProps_1 = __importDefault(require("./props/defaultInitGTProps"));
var internal_1 = require("generaltranslation/internal");
var loadTranslation_1 = __importDefault(require("./loadTranslation"));
/**
 * Manages translations
 */
var TranslationManager = /** @class */ (function () {
    /**
     * Creates an instance of TranslationManager.
     * @constructor
     */
    function TranslationManager() {
        this.config = {
            cacheUrl: internal_1.defaultCacheUrl,
            projectId: '',
            _versionId: undefined,
            translationEnabled: true,
            cacheExpiryTime: defaultInitGTProps_1.default.cacheExpiryTime,
        };
        this.translationsMap = new Map();
        this.translationTimestamps = new Map();
        this.fetchPromises = new Map();
        this.requestedTranslations = new Map();
    }
    /**
     * Sets the configuration for the TranslationManager.
     * @param {Partial<TranslationManagerConfig>} newConfig - The new configuration to apply.
     */
    TranslationManager.prototype.setConfig = function (newConfig) {
        this.config = __assign(__assign({}, this.config), newConfig);
    };
    /**
     * Fetches translations from the remote cache.
     * @param {string} reference - The translation reference.
     * @returns {Promise<TranslationsObject | undefined>} The fetched translations or undefined if not found.
     */
    TranslationManager.prototype._fetchTranslations = function (reference) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.config.translationEnabled)
                            return [2 /*return*/, undefined];
                        return [4 /*yield*/, (0, loadTranslation_1.default)(__assign(__assign(__assign({ targetLocale: reference }, (this.config._versionId && { _versionId: this.config._versionId })), (this.config.cacheUrl && { cacheUrl: this.config.cacheUrl })), (this.config.projectId && { projectId: this.config.projectId })))];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * Retrieves translations for a given locale from the remote or local cache.
     * @param {string} locale - The locale code.
     * @returns {Promise<TranslationsObject | undefined>} The translations data or undefined if not found.
     */
    TranslationManager.prototype.getCachedTranslations = function (locale) {
        return __awaiter(this, void 0, void 0, function () {
            var reference, hasExpired, fetchPromise, retrievedTranslations;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        reference = (0, generaltranslation_1.standardizeLocale)(locale);
                        hasExpired = this.config.loadTranslationType === 'remote' &&
                            this.translationsMap.has(reference) &&
                            Date.now() - ((_a = this.translationTimestamps.get(reference)) !== null && _a !== void 0 ? _a : 0) >
                                this.config.cacheExpiryTime;
                        // Return cached translations if available
                        if (this.translationsMap.has(reference) && !hasExpired) {
                            return [2 /*return*/, this.translationsMap.get(reference)];
                        }
                        if (!this.fetchPromises.has(reference)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.fetchPromises.get(reference)];
                    case 1: return [2 /*return*/, _b.sent()];
                    case 2:
                        fetchPromise = this._fetchTranslations(reference);
                        this.fetchPromises.set(reference, fetchPromise);
                        return [4 /*yield*/, fetchPromise];
                    case 3:
                        retrievedTranslations = _b.sent();
                        this.fetchPromises.delete(reference);
                        // Cache the retrieved translations
                        if (retrievedTranslations) {
                            this.translationsMap.set(reference, retrievedTranslations);
                            this.translationTimestamps.set(reference, Date.now());
                        }
                        return [2 /*return*/, retrievedTranslations];
                }
            });
        });
    };
    /**
     * Retrieves translations for a given locale which are already cached locally.
     * @param {string} locale - The locale code.
     * @returns {TranslationsObject | undefined} The translations data or undefined if not found.
     */
    TranslationManager.prototype.getRecentTranslations = function (locale) {
        var reference = (0, generaltranslation_1.standardizeLocale)(locale);
        return this.translationsMap.get(reference);
    };
    /**
     * Sets a new translation entry.
     * @param {string} locale - The locale code.
     * @param {string} hash - The key for the new entry.
     * @param {TranslationSuccess | TranslationLoading | TranslationError} translation - The translation value.
     * @returns {boolean} True if the entry was set successfully, false otherwise.
     */
    TranslationManager.prototype.setTranslations = function (locale, hash, translation) {
        var _a;
        if (!(locale && hash && translation))
            return false;
        var reference = (0, generaltranslation_1.standardizeLocale)(locale);
        var currentTranslations = this.translationsMap.get(reference) || {};
        this.translationsMap.set(reference, __assign(__assign({}, currentTranslations), (_a = {}, _a[hash] = translation, _a)));
        return true;
    };
    /**
     * Marks translations as requested for a given locale.
     * @param {string} locale - The locale code.
     */
    TranslationManager.prototype.setTranslationRequested = function (locale) {
        var reference = (0, generaltranslation_1.standardizeLocale)(locale);
        this.requestedTranslations.set(reference, true);
    };
    /**
     * Checks if translations have been requested for a given locale.
     * @param {string} locale - The locale code.
     * @returns {boolean} True if requested, false otherwise.
     */
    TranslationManager.prototype.getTranslationRequested = function (locale) {
        var reference = (0, generaltranslation_1.standardizeLocale)(locale);
        return this.requestedTranslations.get(reference) ? true : false;
    };
    return TranslationManager;
}());
exports.TranslationManager = TranslationManager;
var translationManager = new TranslationManager();
exports.default = translationManager;
//# sourceMappingURL=TranslationManager.js.map