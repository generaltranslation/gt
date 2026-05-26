import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { useFormatLocales } from '../../hooks/utils';

type RelativeTimeProps = {
  date?: Date | null | undefined;
  children?: Date | null | undefined;
  name?: string;
  value?: number;
  unit?: Intl.RelativeTimeFormatUnit;
  baseDate?: Date;
  locales?: string[];
  options?: Intl.RelativeTimeFormatOptions;
};

// ===== Component ===== //

function GtInternalRelativeTime({
  date,
  children,
  value,
  unit,
  baseDate,
  locales: localesProp = [],
  options = {},
}: RelativeTimeProps): string | null {
  const locales = useFormatLocales(localesProp);
  const gt = getReactI18nCache().getGTClass();
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

function RelativeTime(props: RelativeTimeProps): React.JSX.Element {
  return <GtInternalRelativeTime {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalRelativeTime._gtt = 'variable-relative-time-automatic';
RelativeTime._gtt = 'variable-relative-time';

// ===== Exports ===== //

export { GtInternalRelativeTime, RelativeTime };
