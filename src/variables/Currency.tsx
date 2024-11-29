import { formatCurrency } from 'generaltranslation';
import getI18NConfig from '../config/getI18NConfig';

/**
 * The `<Currency>` component renders a formatted currency string, allowing customization of name, default value, currency type, and formatting options.
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
function Currency({ 
    children, 
    name, 
    value, 
    currency = "USD", 
    options = {}, 
    locales = [getI18NConfig().getDefaultLocale()],
    ...props 
}: {
    children?: any;
    name?: string;
    value?: any;
    currency?: string;
    options?: Intl.NumberFormatOptions;
    locales?: string[],
    'data-_gt'?: any
}): JSX.Element {
    
    const { "data-_gt": generaltranslation } = props;

    // Determine the value to be formatted
    let renderedValue = (typeof children !== 'undefined' && typeof value === 'undefined') ? children : value;
    renderedValue = (typeof renderedValue === 'string') ? parseFloat(renderedValue) : renderedValue;

    // Format the number as currency according to the locale
    const formattedValue = (typeof renderedValue === 'number') 
        ? formatCurrency({ value: renderedValue, currency, locales, options })
        : renderedValue;

    return (
        <span 
            data-_gt={generaltranslation} 
            data-_gt-variable-name={name} 
            data-_gt-variable-type={"currency"} 
            data-_gt-variable-options={JSON.stringify({ style: 'currency', currency, ...options })}
            data-_gt-unformatted-value={(typeof renderedValue === 'number' && !isNaN(renderedValue)) ? renderedValue : undefined}
            style={{ display: 'contents' }}
            suppressHydrationWarning
        >
            {typeof formattedValue === 'string' ? formattedValue : undefined}
        </span>
    );
};

Currency.gtTransformation = "variable-currency";

export default Currency;