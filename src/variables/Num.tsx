'use client'

import { formatNum } from 'generaltranslation';
import useLocale from '../hooks/useLocale';
import useDefaultLocale from '../hooks/useDefaultLocale';

/**
 * The `<Num>` component renders a formatted number string, allowing customization of the name, default value, and formatting options.
 * It formats the number according to the current locale and optionally passed formatting options.
 * Must be used inside a `<GTProvider>`.
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
 * @param {string|number} [defaultValue] - The default value for the number. Can be a string or number. Strings will be parsed to numbers.
 * @param {Intl.NumberFormatOptions} [options={}] - Optional formatting options for the number, following `Intl.NumberFormatOptions` specifications.
 * @returns {JSX.Element} The formatted number component.
 */
function Num({ children, name = "n", defaultValue, options = {} }: {
    children?: any;
    name?: string;
    defaultValue?: any; // Optional default value for the number
    options?: Intl.NumberFormatOptions // Optional options for the number formatting
} = { name: "n" }): JSX.Element {
    
    const locales = [useLocale(), useDefaultLocale()]
    
    let value = (typeof children !== 'undefined' && typeof defaultValue === 'undefined') ? children : defaultValue;
    value = (typeof value === 'string') ? parseFloat(value) : value;
    if (typeof value === 'number') {
        // Using Intl.NumberFormat for consistent number formatting
        value = formatNum({ value, languages: locales, options });
    }

    return (
        <span data-gt-variable-name={name} data-gt-variable-type={"number"} data-gt-variable-options={JSON.stringify(options)}>
            {value}
        </span>
    );
};

Num.gtTransformation = "variable-number";

export default Num;
