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
var jsx_runtime_1 = require("react/jsx-runtime");
var generaltranslation_1 = require("generaltranslation");
var getI18NConfig_1 = __importDefault(require("../utils/getI18NConfig"));
var getLocale_1 = __importDefault(require("../request/getLocale"));
/**
 * The `<DateTime>` component renders a formatted date or time string, allowing customization of the name, default value, and formatting options.
 * It utilizes the current locale and optional format settings to display the date.
 *
 * @example
 * ```jsx
 * <DateTime
 *    name="createdAt"
 * >
 *    {new Date()}
 * </DateTime>
 * ```
 *
 * @param {any} [children] - Optional content (typically a date) to render inside the component.
 * @param {string} [name="date"] - Optional name for the date field, used for metadata purposes.
 * @param {string|number|Date} [value] - The default value for the date. Can be a string, number (timestamp), or `Date` object.
 * @param {Intl.DateTimeFormatOptions} [options={}] - Optional formatting options for the date, following `Intl.DateTimeFormatOptions` specifications.
 * @returns {Promise<JSX.Element>} The formatted date or time component.
 */
function DateTime(_a) {
    return __awaiter(this, void 0, void 0, function () {
        var I18NConfig, locales, generaltranslation, dateValue, dateString, formattedValue;
        var children = _a.children, _b = _a.name, name = _b === void 0 ? "date" : _b, value = _a.value, _c = _a.options, options = _c === void 0 ? {} : _c, props = __rest(_a, ["children", "name", "value", "options"]);
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    I18NConfig = (0, getI18NConfig_1.default)();
                    return [4 /*yield*/, (0, getLocale_1.default)()];
                case 1:
                    locales = [_d.sent(), I18NConfig.getDefaultLocale()];
                    generaltranslation = props["data-_gt"];
                    // Determine the default value to use
                    if (typeof children !== 'undefined' && typeof value === 'undefined') {
                        value = children;
                    }
                    if (!value) {
                        return [2 /*return*/, ((0, jsx_runtime_1.jsx)("span", { "data-_gt": generaltranslation, "data-_gt-variable-name": name, "data-_gt-variable-type": "date", "data-_gt-variable-options": options, style: { display: 'contents' } }))];
                    }
                    if (typeof value === 'number') {
                        dateValue = new Date(value * 1000); // Assuming Unix time is in seconds
                    }
                    else if (typeof value === 'string') {
                        dateValue = new Date(value);
                    }
                    else if (value instanceof Date) {
                        dateValue = value;
                    }
                    dateString = dateValue ? (0, generaltranslation_1.formatDateTime)({ value: dateValue, locales: locales, options: options }) : '';
                    formattedValue = dateString.replace(/[\u200F\u202B\u202E]/g, '');
                    // Render the formatted date within a span element
                    return [2 /*return*/, ((0, jsx_runtime_1.jsx)("span", { "data-_gt": generaltranslation, "data-_gt-variable-name": name, "data-_gt-variable-type": "date", "data-_gt-variable-options": JSON.stringify(options), "data-_gt-unformatted-value": isValidDate(dateValue) ? dateValue : undefined, style: { display: 'contents' }, children: formattedValue }))];
            }
        });
    });
}
;
DateTime.gtTransformation = "variable-datetime";
exports.default = DateTime;
/**
 * Checks if the input is a valid date object or a string that can be converted to a date.
 * @param {any} input - The input to check.
 * @returns {boolean} - Returns true if the input is a valid date, false otherwise.
 */
function isValidDate(input) {
    var date = new Date(input);
    return !isNaN(date.getTime());
}
//# sourceMappingURL=DateTime.js.map