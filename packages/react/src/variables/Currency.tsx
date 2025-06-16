import React, { useContext } from 'react';
import { GT } from 'generaltranslation';
import { GTContext } from '../provider/GTContext';

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
 * @param {number | string | null | undefined} children - Content to render inside the currency component.
 * @param {string} [currency="USD"] - The currency type (e.g., USD, EUR, etc.).
 * @param {string[]} [locales] - Optional locales to use for currency formatting. If wrapped in a `<GTProvider>`, the user's locale is used.
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
  locales?: string[];
  options?: Intl.NumberFormatOptions;
}): React.JSX.Element | null {
  if (!children) return null;
  const context = useContext(GTContext);
  const gt = context?.gt || new GT();
  let renderedValue: string | number =
    typeof children === 'string' ? parseFloat(children) : children;
  if (typeof renderedValue === 'number') {
    // Format the value using Intl.NumberFormat
    renderedValue = gt.formatCurrency(renderedValue, currency, {
      locales,
      ...options,
    });
  }

  return <>{renderedValue}</>;
}

// Static property to indicate the transformation type
Currency.gtTransformation = 'variable-currency';

export default Currency;
