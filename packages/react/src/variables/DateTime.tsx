import React, { useContext } from 'react';
import { GT } from 'generaltranslation';
import { GTContext } from '../provider/GTContext';

/**
 * The `<DateTime>` component renders a formatted date or time string, allowing customization of the name, default value, and formatting options.
 * It utilizes the current locale and optional format settings to display the date.
 * Must be used inside a `<GTProvider>`.
 *
 * @example
 * ```jsx
 * <DateTime>
 *    {new Date()}
 * </DateTime>
 * ```
 *
 * @param {Date} children - Content to render inside the date component.
 * @param {string[]} [locales] - Optional locales to use for date formatting. If wrapped in a `<GTProvider>`, the user's locale is used.
 * @param {Intl.DateTimeFormatOptions} [options={}] - Optional formatting options for the date, following `Intl.DateTimeFormatOptions` specifications.
 * @returns {JSX.Element} The formatted date or time component.
 */
function DateTime({
  children,
  locales,
  options = {},
}: {
  children: Date | null | undefined;
  locales?: string[];
  options?: Intl.DateTimeFormatOptions; // Optional formatting options for the date
}): React.JSX.Element | null {
  const context = useContext(GTContext);
  if (!children) return null;
  const gt = context?.gt || new GT();

  if (!locales) {
    locales ||= [];
    if (context?.locale) locales.push(context.locale);
    if (context?.defaultLocale) locales.push(context.defaultLocale);
  }
  const result = gt
    .formatDateTime(children, { locales, ...options })
    .replace(/[\u200F\u202B\u202E]/g, '');

  return <>{result}</>;
}

// Static property for transformation type
DateTime.gtTransformation = 'variable-datetime';

export default DateTime;
