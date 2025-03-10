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
exports.default = getDictionary;
exports.getDictionaryEntry = getDictionaryEntry;
var internal_1 = require("gt-react/internal");
var createErrors_1 = require("../errors/createErrors");
var resolveDictionaryDictionary_1 = __importDefault(require("../loaders/resolveDictionaryDictionary"));
var defaultWithGTConfigProps_1 = __importDefault(require("../config-dir/props/defaultWithGTConfigProps"));
var generaltranslation_1 = require("generaltranslation");
var dictionary = undefined;
function getDictionary() {
    return __awaiter(this, void 0, void 0, function () {
        var dictionaryFileType, customLoadDictionary, defaultLocale, _a, languageCode, error_1;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    // Singleton pattern
                    if (dictionary !== undefined)
                        return [2 /*return*/, dictionary];
                    dictionaryFileType = process.env._GENERALTRANSLATION_DICTIONARY_FILE_TYPE;
                    // First, check for a dictionary file (takes precedence)
                    try {
                        if (dictionaryFileType === '.json') {
                            dictionary = require('gt-next/_dictionary');
                        }
                        else if (dictionaryFileType === '.ts' || dictionaryFileType === '.js') {
                            dictionary = require('gt-next/_dictionary').default;
                        }
                    }
                    catch (_d) { }
                    if (dictionary)
                        return [2 /*return*/, dictionary];
                    customLoadDictionary = (0, resolveDictionaryDictionary_1.default)();
                    if (!customLoadDictionary) return [3 /*break*/, 8];
                    defaultLocale = process.env._GENERALTRANSLATION_DEFAULT_LOCALE ||
                        defaultWithGTConfigProps_1.default.defaultLocale;
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, customLoadDictionary(defaultLocale)];
                case 2:
                    dictionary = _c.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _a = _c.sent();
                    return [3 /*break*/, 4];
                case 4:
                    languageCode = (_b = (0, generaltranslation_1.getLocaleProperties)(defaultLocale)) === null || _b === void 0 ? void 0 : _b.languageCode;
                    if (!(!dictionary && languageCode && languageCode !== defaultLocale)) return [3 /*break*/, 8];
                    _c.label = 5;
                case 5:
                    _c.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, customLoadDictionary(languageCode)];
                case 6:
                    dictionary = _c.sent();
                    return [3 /*break*/, 8];
                case 7:
                    error_1 = _c.sent();
                    if (process.env.NODE_ENV === 'development') {
                        console.warn((0, createErrors_1.customLoadDictionaryWarning)(languageCode), error_1);
                    }
                    return [3 /*break*/, 8];
                case 8:
                    if (!dictionary) {
                        dictionary = {};
                    }
                    return [2 /*return*/, dictionary];
            }
        });
    });
}
function getDictionaryEntry(id) {
    if (!dictionary)
        return undefined;
    return (0, internal_1.getDictionaryEntry)(dictionary, id);
}
//# sourceMappingURL=getDictionary.js.map