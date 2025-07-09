import getI18NConfig from '../config-dir/getI18NConfig';
import { useLocale } from '../request/getLocale';
import React from 'react';

/**
 * The `<Currency>` component renders a formatted currency string, allowing customization of name, default value, currency type, and formatting options.
 *
 * @example
 * ```jsx
 * <Currency currency="USD">
 *    1000
 * </Currency>
 * ```
 *
 * @param {number | string | null | undefined} children - Content to render inside the currency component.
 * @param {string} [currency="USD"] - The currency type (e.g., USD, EUR, etc.).
 * @param {string[]} [locales] - Optional locales to use for currency formatting. If not provided, the library will default to the user's locale..
 * @param {Intl.NumberFormatOptions} [options={}] - Optional formatting options to customize how the currency is displayed.
 * @returns {JSX.Element} The formatted currency component.
 */
function Currency({
  children,
  currency = 'USD',
  locales,
  options = {},
}: {
  children: number | string | null | undefined;
  currency?: string;
  name?: string;
  options?: Intl.NumberFormatOptions;
  locales?: string[];
}): React.JSX.Element | null {
  if (!children) return null;
  if (!locales) {
    locales = [useLocale(), getI18NConfig().getDefaultLocale()];
  }

  const gt = getI18NConfig().getGTClass();

  // Determine the value to be formatted
  const renderedValue =
    typeof children === 'string' ? parseFloat(children) : children;

  // Format the number as currency according to the locale
  const formattedValue =
    typeof renderedValue === 'number'
      ? gt.formatCurrency(renderedValue, currency, { locales, ...options })
      : renderedValue;

  return <>{formattedValue}</>;
}

Currency._gtt = 'variable-currency';

export default Currency;
