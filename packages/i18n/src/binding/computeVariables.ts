import { getI18nConfig } from '../i18n-config/singleton-operations';
import { getRuntimeEnvironment } from '../utils/getRuntimeEnvironment';
import { getFormatLocales } from './formatLocales';

// Framework-free formatting cores for the variable components (Num, Currency,
// DateTime, RelativeTime). The bindings adapt their component props (children,
// slots, `_locale`/`_enableI18n`) onto these signatures.

type BaseComputeArgs = {
  locale: string;
  enableI18n: boolean;
  locales?: string[];
};

export type RelativeTimeFormatOptions = Intl.RelativeTimeFormatOptions & {
  unit?: Intl.RelativeTimeFormatUnit;
  baseDate?: Date;
};

function resolveLocales({ locale, enableI18n, locales }: BaseComputeArgs) {
  return getFormatLocales({ locale, enableI18n, localesProp: locales ?? [] });
}

function parseNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  return typeof value === 'string' ? parseFloat(value) : value;
}

function parseDate(
  value: Date | string | number | null | undefined
): Date | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a number with locale-aware formatting.
 */
export function computeNum({
  value,
  options = {},
  ...conditions
}: BaseComputeArgs & {
  value: number | string | null | undefined;
  options?: Intl.NumberFormatOptions;
}): string | null {
  const parsed = parseNumber(value);
  if (parsed == null) return null;
  return getI18nConfig()
    .getGTClass()
    .formatNum(parsed, { locales: resolveLocales(conditions), ...options });
}

/**
 * Formats a currency value with locale-aware formatting.
 */
export function computeCurrency({
  value,
  currency = 'USD',
  options = {},
  ...conditions
}: BaseComputeArgs & {
  value: number | string | null | undefined;
  currency?: string;
  options?: Intl.NumberFormatOptions;
}): string | null {
  const parsed = parseNumber(value);
  if (parsed == null) return null;
  return getI18nConfig()
    .getGTClass()
    .formatCurrency(parsed, currency, {
      locales: resolveLocales(conditions),
      ...options,
    });
}

/**
 * Formats a date or time with locale-aware formatting.
 */
export function computeDateTime({
  value,
  options = {},
  ...conditions
}: BaseComputeArgs & {
  value: Date | string | number | null | undefined;
  options?: Intl.DateTimeFormatOptions;
}): string | null {
  const date = parseDate(value);
  if (date == null) return null;
  return getI18nConfig()
    .getGTClass()
    .formatDateTime(date, { locales: resolveLocales(conditions), ...options })
    .replace(/[\u200F\u202B\u202E]/g, '');
}

/**
 * Formats a relative time (e.g. "3 days ago") with locale-aware formatting.
 * Uses `value` + `unit` when provided, otherwise formats relative to `date`.
 */
export function computeRelativeTime({
  date,
  value,
  unit,
  baseDate,
  options = {},
  ...conditions
}: BaseComputeArgs & {
  date?: Date | string | number | null;
  value?: number;
  unit?: Intl.RelativeTimeFormatUnit;
  baseDate?: Date;
  options?: RelativeTimeFormatOptions;
}): string | null {
  const locales = resolveLocales(conditions);
  const gt = getI18nConfig().getGTClass();

  if (
    getRuntimeEnvironment() === 'development' &&
    value !== undefined &&
    !unit
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      'RelativeTime: `value` was provided without `unit`. The `value` will be ignored.'
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

  const resolvedDate = parseDate(date);
  if (resolvedDate == null) return null;
  return gt.formatRelativeTimeFromDate(resolvedDate, {
    locales,
    baseDate: baseDate ?? options.baseDate ?? new Date(),
    numeric: options.numeric,
    style: options.style,
    localeMatcher: options.localeMatcher,
  });
}
