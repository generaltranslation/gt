import { formatNum } from 'generaltranslation';
import getI18NConfig from '../utils/getI18NConfig';
import getLocale from '../request/getLocale';

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
async function Num({ 
    children, name = "n", value, options = {}, ...props 
}: {
    children?: any;
    name?: string;
    value?: any;
    options?: Intl.NumberFormatOptions
    'data-_gt'?: any
}): Promise<JSX.Element> {

    const I18NConfig = getI18NConfig();
    const locales = [await getLocale(), I18NConfig.getDefaultLocale() ]

    const { "data-_gt": generaltranslation } = props;

    // Determine the value to be used
    let renderedValue = (typeof children !== 'undefined' && typeof value === 'undefined') ? children : value;
    renderedValue = (typeof renderedValue === 'string') ? parseFloat(renderedValue) : renderedValue;

    // Format the number according to the locale
    const formattedValue = (typeof renderedValue === 'number') ? 
        formatNum({ value: renderedValue, languages: locales, options }) : 
            renderedValue;

    return (
        <span 
            data-_gt={generaltranslation} 
            data-_gt-variable-name={name} 
            data-_gt-variable-type={"number"} 
            data-_gt-variable-options={JSON.stringify(options)}
            data-_gt-unformatted-value={typeof renderedValue === 'number' && !isNaN(renderedValue) ? renderedValue : undefined}
            style={{ display: 'contents' }}
        >
            {formattedValue}
        </span>
    );

};

Num.gtTransformation = "variable-number";

export default Num;