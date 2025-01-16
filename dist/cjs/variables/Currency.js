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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var generaltranslation_1 = require("generaltranslation");
var getI18NConfig_1 = __importDefault(require("../config/getI18NConfig"));
/**
 * The `<Currency>` component renders a formatted currency string, allowing customization of name, default value, currency type, and formatting options.
 *
 * @example
 * ```jsx
 * <Currency
 *    name="price"
 *    currency="USD"
 * >
 *    1000
 * </Currency>
 * ```
 *
 * @param {any} [children] - Optional content to render inside the currency component.
 * @param {string} [name] - Optional name for the currency field.
 * @param {any} [value] - The default value to be used.
 * @param {string} [currency] - The currency type (e.g., USD, EUR, etc.).
 * @param {Intl.NumberFormatOptions} [options] - Optional formatting options to customize how the currency is displayed.
 * @returns {JSX.Element} The formatted currency component.
 */
function Currency(_a) {
    var children = _a.children, name = _a.name, value = _a.value, _b = _a.currency, currency = _b === void 0 ? "USD" : _b, _c = _a.options, options = _c === void 0 ? {} : _c, _d = _a.locales, locales = _d === void 0 ? [(0, getI18NConfig_1.default)().getDefaultLocale()] : _d, props = __rest(_a, ["children", "name", "value", "currency", "options", "locales"]);
    var generaltranslation = props["data-_gt"];
    // Determine the value to be formatted
    var renderedValue = (typeof children !== 'undefined' && typeof value === 'undefined') ? children : value;
    renderedValue = (typeof renderedValue === 'string') ? parseFloat(renderedValue) : renderedValue;
    // Format the number as currency according to the locale
    var formattedValue = (typeof renderedValue === 'number')
        ? (0, generaltranslation_1.formatCurrency)({ value: renderedValue, currency: currency, locales: locales, options: options })
        : renderedValue;
    return ((0, jsx_runtime_1.jsx)("span", { "data-_gt": generaltranslation, "data-_gt-variable-name": name, "data-_gt-variable-type": "currency", "data-_gt-variable-options": JSON.stringify(__assign({ style: 'currency', currency: currency }, options)), "data-_gt-unformatted-value": (typeof renderedValue === 'number' && !isNaN(renderedValue)) ? renderedValue : undefined, style: { display: 'contents' }, suppressHydrationWarning: true, children: typeof formattedValue === 'string' ? formattedValue : undefined }));
}
;
Currency.gtTransformation = "variable-currency";
exports.default = Currency;
//# sourceMappingURL=Currency.js.map