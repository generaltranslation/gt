import type { VNodeChild } from 'vue';
import {
  computeCurrency,
  computeDateTime,
  computeNum,
  computeRelativeTime,
} from 'gt-i18n/internal';
import type { RelativeTimeFormatOptions } from 'gt-i18n/internal';
import type { GTFunctionalComponent } from '../types';
import { getConditionStore } from '../condition-store';
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
  locales?: string[];
} {
  return {
    locale: props._locale ?? getConditionStore().getLocale(),
    enableI18n: props._enableI18n ?? getConditionStore().getEnableI18n(),
    locales: props.locales,
  };
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
  return computeNum({
    value: props.value ?? getVNodeChildText(slots.default?.()),
    options: props.options,
    ...resolveConditions(props),
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
  return computeCurrency({
    value: props.value ?? getVNodeChildText(slots.default?.()),
    currency: props.currency,
    options: props.options,
    ...resolveConditions(props),
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
  return computeDateTime({
    value: props.value ?? getVNodeChildText(slots.default?.()),
    options: props.options,
    ...resolveConditions(props),
  });
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
  return computeRelativeTime({
    date: props.date ?? getVNodeChildText(slots.default?.()),
    value: props.value,
    unit: props.unit ?? props.options?.unit,
    baseDate: props.baseDate,
    options: props.options,
    ...resolveConditions(props),
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
