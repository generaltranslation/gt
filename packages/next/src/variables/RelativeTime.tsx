import getI18NConfig from '../config-dir/getI18NConfig';
import { useLocale } from '../request/getLocale';
import React from 'react';

/**
 * The `<RelativeTime>` component renders a localized relative time string
 * (e.g., "2 hours ago", "in 3 days") using `Intl.RelativeTimeFormat`.
 *
 * @example
 * ```jsx
 * <RelativeTime>{someDate}</RelativeTime>
 * // → "2 hours ago"
 * ```
 *
 * @example
 * ```jsx
 * <RelativeTime value={-1} unit="day" />
 * // → "yesterday"
 * ```
 *
 * @param {Date} [children] - A date to compute relative time from now.
 * @param {number} [value] - Explicit numeric value. Requires `unit`.
 * @param {Intl.RelativeTimeFormatUnit} [unit] - The unit of time.
 * @param {string[]} [locales] - Override locales.
 * @param {Intl.RelativeTimeFormatOptions} [options={}] - Formatting options.
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
  if (!locales) {
    locales = [useLocale(), getI18NConfig().getDefaultLocale()];
  }

  const gt = getI18NConfig().getGTClass();
  let result: string;

  if (value !== undefined && unit) {
    result = gt.formatRelativeTime(value, unit, { locales, ...options });
  } else if (children != null) {
    result = gt.formatRelativeTimeFromDate(children, { locales, ...options });
  } else {
    return null;
  }

  result = result.replace(/[\u200F\u202B\u202E]/g, '');
  return <>{result}</>;
}

/** @internal _gtt - The GT transformation for the component. */
RelativeTime._gtt = 'variable-relative-time';

export default RelativeTime;
