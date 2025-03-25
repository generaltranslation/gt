/**
 * The `<Num>` component renders a formatted number string, allowing customization of the name, default value, and formatting options.
 * It formats the number according to the current locale and optionally passed formatting options.
 *
 * @example
 * ```jsx
 * <Num
 *    options={{ style: "decimal", maximumFractionDigits: 2 }}
 * >
 *    1000
 * </Num>
 * ```
 *
 * @param {any} [children] - Optional content (typically a number) to render inside the component.
 * @param {Intl.NumberFormatOptions} [options={}] - Optional formatting options for the number, following `Intl.NumberFormatOptions` specifications.
 * @returns {Promise<React.JSX.Element>} The formatted number component.
 */
declare function Num({ children, name, locales, options, }: {
    children?: any;
    name?: string;
    options?: Intl.NumberFormatOptions;
    locales?: string[];
}): Promise<React.JSX.Element>;
declare namespace Num {
    var gtTransformation: string;
}
export default Num;
//# sourceMappingURL=Num.d.ts.map