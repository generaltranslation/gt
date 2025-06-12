import React, { useContext } from 'react';
import GT from 'generaltranslation';
import { GTContext } from '../provider/GTContext';
import { libraryDefaultLocale } from 'generaltranslation/internal';

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
 * @param {any} [children] - Optional content (typically a date) to render inside the component.
 * @param {string[]} [locales] - Optional locales to use for date formatting. If not provided, the library default locale (en-US) is used. If wrapped in a `<GTProvider>`, the user's locale is used.
 * @param {Intl.DateTimeFormatOptions} [options={}] - Optional formatting options for the date, following `Intl.DateTimeFormatOptions` specifications.
 * @returns {JSX.Element} The formatted date or time component.
 */
function DateTime({
  children,
  locales,
  options = {},
}: {
  children: Date;
  locales?: string[];
  name?: string;
  options?: Intl.DateTimeFormatOptions; // Optional formatting options for the date
}): React.JSX.Element {
  const context = useContext(GTContext);
  const gt = context?.gt || new GT();

  const result = gt
    .formatDateTime(children, { locales, ...options })
    .replace(/[\u200F\u202B\u202E]/g, '');

  return <>{result}</>;
}

// Static property for transformation type
DateTime.gtTransformation = 'variable-datetime';

export default DateTime;
