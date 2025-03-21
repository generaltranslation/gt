/**
 * The `<Currency>` component renders a formatted currency string, allowing customization of name, default value, currency type, and formatting options.
 *
 * @example
 * ```jsx
 * <Currency
 *    currency="USD"
 * >
 *    1000
 * </Currency>
 * ```
 *
 * @param {any} [children] - Optional content to render inside the currency component.
 * @param {string} [currency] - The currency type (e.g., USD, EUR, etc.).
 * @param {Intl.NumberFormatOptions} [options] - Optional formatting options to customize how the currency is displayed.
 * @returns {Promise<React.JSX.Element>} The formatted currency component.
 */
declare function Currency({ children, currency, options, locales, }: {
    children?: any;
    currency?: string;
    options?: Intl.NumberFormatOptions;
    locales?: string[];
}): Promise<React.JSX.Element>;
declare namespace Currency {
    var gtTransformation: string;
}
export default Currency;
//# sourceMappingURL=Currency.d.ts.map