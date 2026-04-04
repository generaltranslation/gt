import { getBrowserI18nManager } from '../../browser-i18n-manager/singleton-operations';
import { getDefaultLocale, getLocale } from '../locale-operations';

/**
 * Equivalent to the `<RelativeTime>` component, but used for auto insertion
 */
function GtInternalRelativeTime({
  date,
  children,
  value,
  unit,
  baseDate,
  locales: localesProp = [],
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
}): string | null {
  const i18nManager = getBrowserI18nManager();
  const gt = i18nManager.getGTClass();
  const locales = [...localesProp, getLocale(), getDefaultLocale()];

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
      localeMatcher: options.localeMatcher,
    });
  } else if (resolvedDate != null) {
    // Auto-select unit from Date
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
  return result;
}

/**
 * User facing component for the `<RelativeTime>` variable
 */
function RelativeTime(props: {
  date?: Date | null | undefined;
  children?: Date | null | undefined;
  value?: number;
  unit?: Intl.RelativeTimeFormatUnit;
  baseDate?: Date;
  locales?: string[];
  options?: Intl.RelativeTimeFormatOptions;
}): string | null {
  return GtInternalRelativeTime(props);
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalRelativeTime._gtt = 'variable-relative-time-automatic';
RelativeTime._gtt = 'variable-relative-time';

export { GtInternalRelativeTime, RelativeTime };
