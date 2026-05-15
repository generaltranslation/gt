import { getReactI18nManager } from '../../i18n-manager/singleton-operations';
import { useFormatLocales } from '../../hooks/utils';

// ===== Component ===== //

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
  name?: string;
  value?: number;
  unit?: Intl.RelativeTimeFormatUnit;
  baseDate?: Date;
  locales?: string[];
  options?: Intl.RelativeTimeFormatOptions;
}): string | null {
  const locales = useFormatLocales(localesProp);
  const gt = getReactI18nManager().getGTClass();
  const resolvedDate = date ?? children;

  if (process.env.NODE_ENV === 'development' && value !== undefined && !unit) {
    // eslint-disable-next-line no-console
    console.warn(
      '<RelativeTime>: `value` was provided without `unit`. The `value` prop will be ignored.'
    );
  }

  if (value !== undefined && unit) {
    return gt.formatRelativeTime(value, unit, {
      locales,
      numeric: options.numeric,
      style: options.style,
      localeMatcher: options.localeMatcher,
    });
  }

  if (resolvedDate != null) {
    return gt.formatRelativeTimeFromDate(resolvedDate, {
      locales,
      baseDate: baseDate ?? new Date(),
      numeric: options.numeric,
      style: options.style,
      localeMatcher: options.localeMatcher,
    });
  }

  return null;
}

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

// ===== Exports ===== //

export { GtInternalRelativeTime, RelativeTime };
