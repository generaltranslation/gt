import React, { useContext } from 'react';
import { GT } from 'generaltranslation';
import { GTContext } from '../provider/GTContext';

/**
 * The `<RelativeTime>` component renders a localized relative time string
 * (e.g., "2 hours ago", "in 3 days") using `Intl.RelativeTimeFormat`.
 * Must be used inside a `<GTProvider>`.
 *
 * @example
 * ```jsx
 * // Auto-select unit from a Date
 * <RelativeTime>
 *    {someDate}
 * </RelativeTime>
 * // → "2 hours ago"
 * ```
 *
 * @example
 * ```jsx
 * // Explicit value and unit
 * <RelativeTime value={-1} unit="day" />
 * // → "yesterday"
 * ```
 *
 * @param {Date} [children] - A date to compute relative time from now. Mutually exclusive with `value`/`unit`.
 * @param {number} [value] - Explicit numeric value for relative time. Requires `unit`.
 * @param {Intl.RelativeTimeFormatUnit} [unit] - The unit of time (e.g., 'second', 'minute', 'hour', 'day', 'month', 'year'). Required when using `value`.
 * @param {string[]} [locales] - Optional locales for formatting. If wrapped in a `<GTProvider>`, the user's locale is used.
 * @param {Intl.RelativeTimeFormatOptions} [options={}] - Optional formatting options following `Intl.RelativeTimeFormatOptions`.
 * @returns {JSX.Element | null} The formatted relative time string.
 */
function RelativeTime({
  children,
  value,
  unit,
  locales,
  options = {},
}: {
  children?: Date | null | undefined;
  name?: string;
  value?: number;
  unit?: Intl.RelativeTimeFormatUnit;
  locales?: string[];
  options?: Intl.RelativeTimeFormatOptions;
}): React.JSX.Element | null {
  const context = useContext(GTContext);
  const gt = context?.gt || new GT();

  if (!locales) {
    locales = [];
    if (context?.locale) locales.push(context.locale);
    if (context?.defaultLocale) locales.push(context.defaultLocale);
  }

  let result: string;

  if (value !== undefined && unit) {
    // Explicit value + unit mode
    result = gt.formatRelativeTime(value, unit, { locales, ...options });
  } else if (children != null) {
    // Auto-select unit from Date
    result = gt.formatRelativeTimeFromDate(children, { locales, ...options });
  } else {
    return null;
  }

  // Strip RTL override characters
  result = result.replace(/[\u200F\u202B\u202E]/g, '');

  return <>{result}</>;
}

/** @internal _gtt - The GT transformation for the component. */
RelativeTime._gtt = 'variable-relative-time';

export default RelativeTime;
