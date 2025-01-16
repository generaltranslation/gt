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
import { jsx as _jsx } from "react/jsx-runtime";
import { formatNum } from 'generaltranslation';
import getI18NConfig from '../config/getI18NConfig';
/**
 * The `<Num>` component renders a formatted number string, allowing customization of the name, default value, and formatting options.
 * It formats the number according to the current locale and optionally passed formatting options.
 *
 * @example
 * ```jsx
 * <Num
 *    name="quantity"
 *    options={{ style: "decimal", maximumFractionDigits: 2 }}
 * >
 *    1000
 * </Num>
 * ```
 *
 * @param {any} [children] - Optional content (typically a number) to render inside the component.
 * @param {string} [name="n"] - Optional name for the number field, used for metadata purposes.
 * @param {string|number} [value] - The default value for the number. Can be a string or number. Strings will be parsed to numbers.
 * @param {Intl.NumberFormatOptions} [options={}] - Optional formatting options for the number, following `Intl.NumberFormatOptions` specifications.
 * @returns {Promise<JSX.Element>} The formatted number component.
 */
function Num(_a) {
    var children = _a.children, name = _a.name, value = _a.value, _b = _a.options, options = _b === void 0 ? {} : _b, _c = _a.locales, locales = _c === void 0 ? [getI18NConfig().getDefaultLocale()] : _c, props = __rest(_a, ["children", "name", "value", "options", "locales"]);
    var generaltranslation = props["data-_gt"];
    // Determine the value to be used
    var renderedValue = (typeof children !== 'undefined' && typeof value === 'undefined') ? children : value;
    renderedValue = (typeof renderedValue === 'string') ? parseFloat(renderedValue) : renderedValue;
    // Format the number according to the locale
    var formattedValue = (typeof renderedValue === 'number') ?
        formatNum({ value: renderedValue, locales: locales, options: options }) :
        renderedValue;
    return (_jsx("span", { "data-_gt": generaltranslation, "data-_gt-variable-name": name, "data-_gt-variable-type": "number", "data-_gt-variable-options": JSON.stringify(options), "data-_gt-unformatted-value": typeof renderedValue === 'number' && !isNaN(renderedValue) ? renderedValue : undefined, style: { display: 'contents' }, suppressHydrationWarning: true, children: formattedValue }));
}
;
Num.gtTransformation = "variable-number";
export default Num;
//# sourceMappingURL=Num.js.map