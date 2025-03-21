import { formatNum } from 'generaltranslation';
import getI18NConfig from '../config-dir/getI18NConfig';
import getLocale from '../request/getLocale';

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
async function Num({
  children,
  options = {},
  locales = [getI18NConfig().getDefaultLocale()],
}: {
  children?: any;
  options?: Intl.NumberFormatOptions;
  locales?: string[];
}): Promise<React.JSX.Element> {
  locales = [await getLocale(), ...locales];

  // Determine the value to be used
  const renderedValue =
    typeof children === 'string' ? parseFloat(children) : children;

  // Format the number according to the locale
  const formattedValue =
    typeof renderedValue === 'number'
      ? formatNum(renderedValue, { locales, ...options })
      : renderedValue;

  return <>{formattedValue}</>;
}

Num.gtTransformation = 'variable-number';

export default Num;
