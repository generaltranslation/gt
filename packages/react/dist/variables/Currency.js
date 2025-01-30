"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const generaltranslation_1 = require("generaltranslation");
const useLocale_1 = __importDefault(require("../hooks/useLocale"));
const useDefaultLocale_1 = __importDefault(require("../hooks/useDefaultLocale"));
/**
 * The `<Currency>` component renders a formatted currency string, allowing customization of name, default value, currency type, and formatting options.
 * Must be used inside a `<GTProvider>`.
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
function Currency({ children, value, name, currency = "USD", locales, options = {}, }) {
    const providerLocales = [(0, useLocale_1.default)(), (0, useDefaultLocale_1.default)()];
    locales || (locales = providerLocales);
    let renderedValue = typeof children !== "undefined" && typeof value === "undefined"
        ? children
        : value;
    renderedValue =
        typeof renderedValue === "string"
            ? parseFloat(renderedValue)
            : renderedValue;
    // Format the value using Intl.NumberFormat
    if (typeof renderedValue === "number") {
        renderedValue = (0, generaltranslation_1.formatCurrency)({
            value: renderedValue,
            locales,
            currency,
            options,
        });
    }
    return ((0, jsx_runtime_1.jsx)("span", { "data-_gt-variable-name": name, "data-_gt-variable-type": "currency", "data-_gt-variable-options": JSON.stringify(Object.assign({ style: "currency", currency }, options)), style: { display: "contents" }, suppressHydrationWarning: true, children: renderedValue }));
}
// Static property to indicate the transformation type
Currency.gtTransformation = "variable-currency";
exports.default = Currency;
//# sourceMappingURL=Currency.js.map