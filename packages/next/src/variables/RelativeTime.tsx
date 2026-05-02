import { getI18NConfig } from '../config-dir/getI18NConfig';
import { useLocale } from '../request/getLocale';
import React from 'react';

/**
 * The `<RelativeTime>` component renders a localized relative time string
 * (e.g., "2 hours ago", "in 3 days") using `Intl.RelativeTimeFormat`.
 *
 * @example
 * ```jsx
 * <RelativeTime date={someDate} />
 * // → "2 hours ago"
 * ```
 *
 * @example
 * ```jsx
 * <RelativeTime value={-1} unit="day" />
 * // → "yesterday"
 * ```
 *
 * @param {Date} [date] - A date to compute relative time from now.
 * @param {number} [value] - Explicit numeric value. Requires `unit`.
 * @param {Intl.RelativeTimeFormatUnit} [unit] - The unit of time.
 * @param {string} [name] - Optional name for the variable, used by the GT CLI for additional context during extraction.
 * @param {string[]} [locales] - Override locales.
 * @param {Intl.RelativeTimeFormatOptions} [options={}] - Formatting options.
 * @returns {JSX.Element | null} The formatted relative time string.
 */
export function RelativeTime({
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
  if (!locales) {
    locales = [useLocale(), getI18NConfig().getDefaultLocale()];
  }

  const gt = getI18NConfig().getGTClass();

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
    result = gt.formatRelativeTime(value, unit, {
      locales,
      numeric: options.numeric,
      style: options.style,
      localeMatcher: options.localeMatcher,
    });
  } else if (resolvedDate != null) {
    result = gt.formatRelativeTimeFromDate(resolvedDate, {
      locales,
      baseDate: baseDate ?? new Date(),
      numeric: options.numeric,
      style: options.style,
      localeMatcher: options.localeMatcher,
    });
  } else {
    return null;
  }

  // Note: This component may cause hydration errors when the output differs
  // between server and client (e.g., relative time changing between render passes).
  // We cannot use suppressHydrationWarning because this is a purely logical
  // component that returns a text fragment, not a DOM element.
  return <>{result}</>;
}

/** @internal _gtt - The GT transformation for the component. */
RelativeTime._gtt = 'variable-relative-time';
