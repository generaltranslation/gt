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
declare function DateTime({ children, name, value, options, locales, ...props }: {
    children?: any;
    name?: string;
    value?: any;
    options?: Intl.DateTimeFormatOptions;
    locales?: string[];
    'data-_gt'?: any;
}): React.JSX.Element;
declare namespace DateTime {
    var gtTransformation: string;
}
export default DateTime;
//# sourceMappingURL=DateTime.d.ts.map