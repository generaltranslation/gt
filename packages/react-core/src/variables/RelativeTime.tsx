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
 * <RelativeTime date={someDate} />
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
 * @param {Date} [date] - A date to compute relative time from now. Mutually exclusive with `value`/`unit`.
 * @param {number} [value] - Explicit numeric value for relative time. Requires `unit`.
 * @param {Intl.RelativeTimeFormatUnit} [unit] - The unit of time (e.g., 'second', 'minute', 'hour', 'day', 'week', 'month', 'year'). Required when using `value`.
 * @param {string} [name] - Optional name for the variable, used by the GT CLI for additional context during extraction.
 * @param {string[]} [locales] - Optional locales for formatting. If wrapped in a `<GTProvider>`, the user's locale is used.
 * @param {Intl.RelativeTimeFormatOptions} [options={}] - Optional formatting options following `Intl.RelativeTimeFormatOptions`.
 * @returns {JSX.Element | null} The formatted relative time string.
 */
function RelativeTime({
  date,
  children,
  value,
  unit,
  baseDate,
  locales,
  options = {},
}: {
  date?: Date | null | undefined;
  children?: Date | null | undefined;
  /** Used by the GT CLI for additional context during extraction. */
  name?: string;
  value?: number;
  unit?: Intl.RelativeTimeFormatUnit;
  /** Base date for computing relative time. Defaults to `new Date()` at render time. Required for hydration safety. */
  baseDate?: Date;
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

  // Resolve the date from either `date` prop or `children` (for backwards compat)
  const resolvedDate = date ?? children;

  if (process.env.NODE_ENV === 'development' && value !== undefined && !unit) {
    // eslint-disable-next-line no-console
    console.warn(
      '<RelativeTime>: `value` was provided without `unit`. The `value` prop will be ignored.'
    );
  }

  let result: string;

  if (value !== undefined && unit) {
    // Explicit value + unit mode
    result = gt.formatRelativeTime(value, unit, {
      locales,
      numeric: options.numeric,
      style: options.style,
    });
  } else if (resolvedDate != null) {
    // Auto-select unit from Date
    result = gt.formatRelativeTimeFromDate(resolvedDate, {
      locales,
      baseDate: baseDate ?? new Date(),
      numeric: options.numeric,
      style: options.style,
    });
  } else {
    return null;
  }

  return <>{result}</>;
}

/** @internal _gtt - The GT transformation for the component. */
RelativeTime._gtt = 'variable-relative-time';

export default RelativeTime;
