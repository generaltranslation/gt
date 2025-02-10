import React from 'react';
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
declare function DateTime({ children, value, name, locales, options, }: {
    children?: any;
    name?: string;
    value?: any;
    locales?: string[];
    options?: Intl.DateTimeFormatOptions;
}): React.JSX.Element;
declare namespace DateTime {
    var gtTransformation: string;
}
export default DateTime;
//# sourceMappingURL=DateTime.d.ts.map