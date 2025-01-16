"use strict";
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
    var children = _a.children, name = _a.name, value = _a.value, _b = _a.options, options = _b === void 0 ? {} : _b, _c = _a.locales, locales = _c === void 0 ? [(0, getI18NConfig_1.default)().getDefaultLocale()] : _c, props = __rest(_a, ["children", "name", "value", "options", "locales"]);
    // Extract general translation data from props
    var generaltranslation = props["data-_gt"];
    // Determine the default value to use
    if (typeof children !== 'undefined' && typeof value === 'undefined') {
        value = children;
    }
    if (!value) {
        return ((0, jsx_runtime_1.jsx)("span", { "data-_gt": generaltranslation, "data-_gt-variable-name": name, "data-_gt-variable-type": "date", "data-_gt-variable-options": options, style: { display: 'contents' } }));
    }
    // Convert value to a Date object if it's a Unix time, string, or Date object
    var dateValue;
    if (typeof value === 'number') {
        dateValue = new Date(value * 1000); // Assuming Unix time is in seconds
    }
    else if (typeof value === 'string') {
        dateValue = new Date(value);
    }
    else if (value instanceof Date) {
        dateValue = value;
    }
    // Format the date according to the locale and options
    var dateString = dateValue ? (0, generaltranslation_1.formatDateTime)({ value: dateValue, locales: locales, options: options }) : '';
    var formattedValue = dateString.replace(/[\u200F\u202B\u202E]/g, '');
    // Render the formatted date within a span element
    return ((0, jsx_runtime_1.jsx)("span", { "data-_gt": generaltranslation, "data-_gt-variable-name": name, "data-_gt-variable-type": "date", "data-_gt-variable-options": JSON.stringify(options), "data-_gt-unformatted-value": isValidDate(dateValue) ? dateValue : undefined, style: { display: 'contents' }, suppressHydrationWarning: true, children: formattedValue }));
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