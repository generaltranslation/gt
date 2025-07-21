import getI18NConfig from '../config-dir/getI18NConfig';
import { useLocale } from '../request/getLocale';
import React from 'react';

/**
 * The `<DateTime>` component renders a formatted date or time string, allowing customization of the name, default value, and formatting options.
 * It utilizes the current locale and optional format settings to display the date.
 *
 * @example
 * ```jsx
 * <DateTime>
 *    {new Date()}
 * </DateTime>
 * ```
 *
 * @param {Date | null | undefined} children - Optional content to render inside the component.
 * @param {string[]} [locales] - Optional locales to use for date formatting. If not provided, the library default locale (en-US) is used. If wrapped in a `<GTProvider>`, the user's locale is used.
 * @param {Intl.DateTimeFormatOptions} [options={}] - Optional formatting options for the date, following `Intl.DateTimeFormatOptions` specifications.
 * @returns {JSX.Element} The formatted date or time component.
 */
function DateTime({
  children,
  locales,
  options = {},
}: {
  children: Date | null | undefined;
  name?: string;
  options?: Intl.DateTimeFormatOptions; // Optional formatting options for the date
  locales?: string[];
}): React.JSX.Element | null {
  if (children == null) return null;
  if (!locales) {
    locales = [useLocale(), getI18NConfig().getDefaultLocale()];
  }

  const gt = getI18NConfig().getGTClass();

  const result = gt
    .formatDateTime(children, { locales, ...options })
    .replace(/[\u200F\u202B\u202E]/g, '');
  return <>{result}</>;
}
/** @internal _gtt - The GT transformation for the component. */
DateTime._gtt = 'variable-datetime';

export default DateTime;
