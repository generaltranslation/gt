import React, { useContext } from 'react';
import { GT } from 'generaltranslation';
import { GTContext } from '../provider/GTContext';

/**
 * The `<Num>` component renders a formatted number string, allowing customization of the name, default value, and formatting options.
 * It formats the number according to the current locale and optionally passed formatting options.
 * Must be used inside a `<GTProvider>`.
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
 * @param {number | string | null | undefined} children - Content to render inside the number component.
 * @param {string[]} [locales] - Optional locales to use for number formatting. If wrapped in a `<GTProvider>`, the user's locale is used.
 * @param {Intl.NumberFormatOptions} [options={}] - Optional formatting options for the number, following `Intl.NumberFormatOptions` specifications.
 * @returns {React.JSX.Element} The formatted number component.
 */
function Num({
  children,
  locales,
  options = {},
}: {
  children: number | string | null | undefined;
  name?: string;
  locales?: string[];
  options?: Intl.NumberFormatOptions; // Optional options for the number formatting
}): React.JSX.Element | null {
  const context = useContext(GTContext);
  if (!children) return null;
  const gt = context?.gt || new GT();

  let renderedValue: string | number =
    typeof children === 'string' ? parseFloat(children) : children;
  if (typeof renderedValue === 'number') {
    if (!locales) {
      locales ||= [];
      if (context?.locale) locales.push(context.locale);
      if (context?.defaultLocale) locales.push(context.defaultLocale);
    }
    // Using Intl.NumberFormat for consistent number formatting
    renderedValue = gt.formatNum(renderedValue, { locales, ...options });
  }
  return <>{renderedValue}</>;
}

Num.gtTransformation = 'variable-number';

export default Num;
