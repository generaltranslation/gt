import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { getFormatLocales } from '../../hooks/utils';

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

type GtInternalRelativeTimeProps = RelativeTimeProps & {
  _locale?: string;
  _enableI18n?: boolean;
};

type ResolvedRelativeTimeProps = RelativeTimeProps & {
  locale: string;
  enableI18n: boolean;
};

// ===== Shared Logic ===== //

function computeRelativeTime({
  date,
  children,
  enableI18n,
  value,
  unit,
  baseDate,
  locale,
  locales: localesProp = [],
  options = {},
}: ResolvedRelativeTimeProps): string | null {
  const locales = getFormatLocales({ locale, enableI18n, localesProp });
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

// ===== Component ===== //

function GtInternalRelativeTime({
  _enableI18n,
  _locale,
  ...props
}: GtInternalRelativeTimeProps): string | null {
  return computeRelativeTime({
    ...props,
    enableI18n: _enableI18n ?? useEnableI18n(),
    locale: _locale ?? useLocale(),
  });
}

function RelativeTime(props: RelativeTimeProps): React.JSX.Element {
  return <GtInternalRelativeTime {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalRelativeTime._gtt = 'variable-relative-time-automatic';
RelativeTime._gtt = 'variable-relative-time';

// ===== Exports ===== //

export { GtInternalRelativeTime, RelativeTime };
