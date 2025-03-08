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
exports.MessagesManager = void 0;
var generaltranslation_1 = require("generaltranslation");
var resolveMessagesLoader_1 = __importDefault(require("../loaders/resolveMessagesLoader"));
var createErrors_1 = require("../errors/createErrors");
/**
 * Manages messages
 */
var MessagesManager = /** @class */ (function () {
    /**
     * Creates an instance of TranslationManager.
     * @constructor
     */
    function MessagesManager() {
        this.messagesMap = new Map();
    }
    // flatten object helper function
    MessagesManager.prototype._flattenObject = function (obj, parentKey, result) {
        if (parentKey === void 0) { parentKey = ''; }
        if (result === void 0) { result = {}; }
        for (var key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                var newKey = parentKey ? "".concat(parentKey, ".").concat(key) : key;
                var value = obj[key];
                if (value !== null &&
                    typeof value === 'object' &&
                    !Array.isArray(value)) {
                    this._flattenObject(value, newKey, result);
                }
                else {
                    result[newKey] = value;
                }
            }
        }
        return result;
    };
    /**
     * Retrieves messages for a given locale from bundle.
     * @param {string} locale - The locale code.
     * @returns {Promise<MessagesObject | undefined>} The messages data or undefined if not found.
     */
    MessagesManager.prototype.getMessages = function (locale) {
        return __awaiter(this, void 0, void 0, function () {
            var reference, result, customLoadMessages, _a, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        reference = (0, generaltranslation_1.standardizeLocale)(locale);
                        result = this.messagesMap.get(reference);
                        if (result)
                            return [2 /*return*/, result];
                        customLoadMessages = (0, resolveMessagesLoader_1.default)();
                        if (!customLoadMessages) return [3 /*break*/, 4];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        _a = this._flattenObject;
                        return [4 /*yield*/, customLoadMessages(reference)];
                    case 2:
                        result = _a.apply(this, [_b.sent()]);
                        this.messagesMap.set(reference, result);
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _b.sent();
                        if (process.env.NODE_ENV === 'development') {
                            console.warn((0, createErrors_1.customLoadMessagesWarning)(reference), error_1);
                        }
                        return [2 /*return*/, undefined];
                    case 4: return [2 /*return*/, result];
                }
            });
        });
    };
    return MessagesManager;
}());
exports.MessagesManager = MessagesManager;
var messagesManager = new MessagesManager();
exports.default = messagesManager;
//# sourceMappingURL=MessagesManager.js.map