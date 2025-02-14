import { jsx as _jsx } from "react/jsx-runtime";
import { useContext } from 'react';
import { formatDateTime } from 'generaltranslation';
import { GTContext } from '../provider/GTContext';
import { libraryDefaultLocale } from 'generaltranslation/internal';
/**
 * The `<DateTime>` component renders a formatted date or time string, allowing customization of the name, default value, and formatting options.
 * It utilizes the current locale and optional format settings to display the date.
 * Must be used inside a `<GTProvider>`.
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
 * @param {string[]} [locales] - Optional locales to use for date formatting. If not provided, the library default locale (en-US) is used. If wrapped in a `<GTProvider>`, the user's locale is used.
 * @param {Intl.DateTimeFormatOptions} [options={}] - Optional formatting options for the date, following `Intl.DateTimeFormatOptions` specifications.
 * @returns {JSX.Element} The formatted date or time component.
 */
function DateTime({ children, value, name, locales, options = {}, }) {
    const context = useContext(GTContext);
    if (context) {
        locales || (locales = [
            ...(context.locale && [context.locale]),
            context.defaultLocale,
        ]);
    }
    else {
        locales || (locales = [libraryDefaultLocale]);
    }
    let final;
    let dateValue;
    let defaultValue = typeof children !== 'undefined' && typeof value === 'undefined'
        ? children
        : value;
    if (typeof defaultValue === 'number') {
        dateValue = new Date(defaultValue);
    }
    else if (typeof defaultValue === 'string') {
        dateValue = new Date(defaultValue);
    }
    else if (defaultValue instanceof Date) {
        dateValue = defaultValue;
    }
    if (typeof dateValue !== 'undefined') {
        final = formatDateTime({ value: dateValue, locales, options }).replace(/[\u200F\u202B\u202E]/g, '');
    }
    // Render the formatted date within a span element
    return (_jsx("span", { "data-_gt-variable-name": name, "data-_gt-variable-type": 'date', "data-_gt-variable-options": JSON.stringify(options), style: { display: 'contents' }, suppressHydrationWarning: true, children: final }));
}
// Static property for transformation type
DateTime.gtTransformation = 'variable-datetime';
export default DateTime;
