/**
 * The `<DateTime>` component renders a formatted date or time string, allowing customization of the name, default value, and formatting options.
 * It utilizes the current locale and optional format settings to display the date.
 *
 * @example
 * ```jsx
 * <DateTime>
 *    {new Date()}
 * </DateTime>
 * ```
 *
 * @param {any} [children] - Optional content (typically a date) to render inside the component.
 * @param {Intl.DateTimeFormatOptions} [options={}] - Optional formatting options for the date, following `Intl.DateTimeFormatOptions` specifications.
 * @returns {Promise<React.JSX.Element>} The formatted date or time component.
 */
declare function DateTime({ children, name, locales, options, }: {
    children?: any;
    name?: string;
    options?: Intl.DateTimeFormatOptions;
    locales?: string[];
}): Promise<React.JSX.Element>;
declare namespace DateTime {
    var gtTransformation: string;
}
export default DateTime;
//# sourceMappingURL=DateTime.d.ts.map