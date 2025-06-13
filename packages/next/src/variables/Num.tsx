import getI18NConfig from '../config-dir/getI18NConfig';
import { useLocale } from '../request/getLocale';
import React from 'react';

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
 * @param {number | string} children - Content to render inside the number component.
 * @param {string[]} [locales] - Optional locales to use for number formatting. If not provided, the library will default to the user's locale.
 * @param {Intl.NumberFormatOptions} [options={}] - Optional formatting options for the number, following `Intl.NumberFormatOptions` specifications.
 * @returns {Promise<React.JSX.Element>} The formatted number component.
 */
function Num({
  children,
  locales,
  options = {},
}: {
  children: number | string;
  name?: string;
  options?: Intl.NumberFormatOptions;
  locales?: string[];
}): React.JSX.Element {
  if (!locales) {
    locales = [useLocale(), getI18NConfig().getDefaultLocale()];
  }
  const gt = getI18NConfig().getGTClass();

  // Determine the value to be used
  const renderedValue =
    typeof children === 'string' ? parseFloat(children) : children;

  // Format the number according to the locale
  const formattedValue =
    typeof renderedValue === 'number'
      ? gt.formatNum(renderedValue, { locales, ...options })
      : renderedValue;

  return <>{formattedValue}</>;
}

Num.gtTransformation = 'variable-number';

export default Num;
