import React from 'react';
/**
 * The `<Currency>` component renders a formatted currency string, allowing customization of name, default value, currency type, and formatting options.
 * Must be used inside a `<GTProvider>`.
 *
 * @example
 * ```jsx
 * <Currency currency="USD">
 *    1000
 * </Currency>
 * ```
 *
 * @param {any} [children] - Optional content to render inside the currency component.
 * @param {string} [currency] - The currency type (e.g., USD, EUR, etc.).
 * @param {string[]} [locales] - Optional locales to use for currency formatting. If not provided, the library default locale (en-US) is used. If wrapped in a `<GTProvider>`, the user's locale is used.
 * @param {Intl.NumberFormatOptions} [options] - Optional formatting options to customize how the currency is displayed.
 * @returns {JSX.Element} The formatted currency component.
 */
declare function Currency({ children, currency, locales, options, }: {
    children?: any;
    currency?: string;
    locales?: string[];
    options?: Intl.NumberFormatOptions;
}): React.JSX.Element;
declare namespace Currency {
    var gtTransformation: string;
}
export default Currency;
//# sourceMappingURL=Currency.d.ts.map