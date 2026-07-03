import type { VNodeChild } from 'vue';
import type { GTFunctionalComponent } from '../types';
import { getI18nConfig } from 'gt-i18n/internal';
import { getConditionStore } from '../condition-store';
import { getFormatLocales } from '../internal/getFormatLocales';
import { getVNodeChildText } from '../internal/vnode-utils';

type SharedVariableProps = {
  name?: string;
  locales?: string[];
  _locale?: string;
  _enableI18n?: boolean;
};

function resolveConditions(props: SharedVariableProps): {
  locale: string;
  enableI18n: boolean;
} {
  return {
    locale: props._locale ?? getConditionStore().getLocale(),
    enableI18n: props._enableI18n ?? getConditionStore().getEnableI18n(),
  };
}

function resolveFormatLocales(props: SharedVariableProps): string[] {
  const { locale, enableI18n } = resolveConditions(props);
  return getFormatLocales({
    locale,
    enableI18n,
    localesProp: props.locales ?? [],
  });
}

function resolveNumericContent(
  props: { value?: number | string | null },
  slotChildren: VNodeChild
): number | null {
  const raw = props.value ?? getVNodeChildText(slotChildren);
  if (raw == null || raw === '') return null;
  return typeof raw === 'string' ? parseFloat(raw) : raw;
}

function resolveDateContent(
  props: { value?: Date | string | number | null },
  slotChildren: VNodeChild
): Date | null {
  const raw = props.value ?? getVNodeChildText(slotChildren);
  if (raw == null || raw === '') return null;
  const date = raw instanceof Date ? raw : new Date(raw);
  return isNaN(date.getTime()) ? null : date;
}

// ===== Var ===== //

type VarProps = SharedVariableProps & {
  value?: unknown;
};

/**
 * Renders dynamic content as-is. Inside `<T>`, marks the content as a
 * variable that is excluded from translation.
 */
export const Var: GTFunctionalComponent<VarProps> = (props, { slots }) => {
  if (slots.default) return slots.default();
  return props.value as VNodeChild;
};
Var.props = ['name', 'value', 'locales', '_locale', '_enableI18n'];
Var.inheritAttrs = false;
Var._gtt = 'variable-variable';

// ===== Num ===== //

type NumProps = SharedVariableProps & {
  value?: number | string | null;
  options?: Intl.NumberFormatOptions;
};

/**
 * Renders a number with locale-aware formatting.
 */
export const Num: GTFunctionalComponent<NumProps> = (props, { slots }) => {
  const parsed = resolveNumericContent(props, slots.default?.());
  if (parsed == null) return null;
  return getI18nConfig()
    .getGTClass()
    .formatNum(parsed, {
      locales: resolveFormatLocales(props),
      ...props.options,
    });
};
Num.props = ['name', 'value', 'options', 'locales', '_locale', '_enableI18n'];
Num.inheritAttrs = false;
Num._gtt = 'variable-number';

// ===== Currency ===== //

type CurrencyProps = SharedVariableProps & {
  value?: number | string | null;
  currency?: string;
  options?: Intl.NumberFormatOptions;
};

/**
 * Renders a currency value with locale-aware formatting.
 */
export const Currency: GTFunctionalComponent<CurrencyProps> = (
  props,
  { slots }
) => {
  const parsed = resolveNumericContent(props, slots.default?.());
  if (parsed == null) return null;
  return getI18nConfig()
    .getGTClass()
    .formatCurrency(parsed, props.currency ?? 'USD', {
      locales: resolveFormatLocales(props),
      ...props.options,
    });
};
Currency.props = [
  'name',
  'value',
  'currency',
  'options',
  'locales',
  '_locale',
  '_enableI18n',
];
Currency.inheritAttrs = false;
Currency._gtt = 'variable-currency';

// ===== DateTime ===== //

type DateTimeProps = SharedVariableProps & {
  value?: Date | string | number | null;
  options?: Intl.DateTimeFormatOptions;
};

/**
 * Renders a date or time with locale-aware formatting.
 */
export const DateTime: GTFunctionalComponent<DateTimeProps> = (
  props,
  { slots }
) => {
  const date = resolveDateContent(props, slots.default?.());
  if (date == null) return null;
  return getI18nConfig()
    .getGTClass()
    .formatDateTime(date, {
      locales: resolveFormatLocales(props),
      ...props.options,
    })
    .replace(/[\u200F\u202B\u202E]/g, '');
};
DateTime.props = [
  'name',
  'value',
  'options',
  'locales',
  '_locale',
  '_enableI18n',
];
DateTime.inheritAttrs = false;
DateTime._gtt = 'variable-datetime';

// ===== RelativeTime ===== //

type RelativeTimeFormatOptions = Intl.RelativeTimeFormatOptions & {
  unit?: Intl.RelativeTimeFormatUnit;
  baseDate?: Date;
};

type RelativeTimeProps = SharedVariableProps & {
  date?: Date | string | number | null;
  value?: number;
  unit?: Intl.RelativeTimeFormatUnit;
  baseDate?: Date;
  options?: RelativeTimeFormatOptions;
};

/**
 * Renders a relative time (e.g. "3 days ago") with locale-aware formatting.
 */
export const RelativeTime: GTFunctionalComponent<RelativeTimeProps> = (
  props,
  { slots }
) => {
  const locales = resolveFormatLocales(props);
  const gt = getI18nConfig().getGTClass();
  const options = props.options ?? {};

  const unit = props.unit ?? options.unit;
  if (props.value !== undefined && unit) {
    return gt.formatRelativeTime(props.value, unit, {
      locales,
      numeric: options.numeric,
      style: options.style,
      localeMatcher: options.localeMatcher,
    });
  }

  const date = resolveDateContent({ value: props.date }, slots.default?.());
  if (date == null) return null;
  return gt.formatRelativeTimeFromDate(date, {
    locales,
    baseDate: props.baseDate ?? options.baseDate ?? new Date(),
    numeric: options.numeric,
    style: options.style,
    localeMatcher: options.localeMatcher,
  });
};
RelativeTime.props = [
  'name',
  'date',
  'value',
  'unit',
  'baseDate',
  'options',
  'locales',
  '_locale',
  '_enableI18n',
];
RelativeTime.inheritAttrs = false;
RelativeTime._gtt = 'variable-relative-time';
