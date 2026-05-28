import type { ReactNode } from 'react';
import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import type {
  RelativeTimeFormatOptions,
  RenderVariable,
} from '../../utils/types';

type CurrencyOptions = Intl.NumberFormatOptions & {
  currency?: string;
};

const renderServerVariable: RenderVariable = ({
  variableType,
  variableValue,
  variableOptions,
  locales,
}) => {
  const gt = getReactI18nCache().getGTClass();

  if (variableType === 'n') {
    const value =
      typeof variableValue === 'string' || typeof variableValue === 'number'
        ? variableValue
        : variableValue == null
          ? variableValue
          : undefined;
    if (value == null) return null;
    return gt.formatNum(typeof value === 'string' ? parseFloat(value) : value, {
      locales,
      ...(variableOptions as Intl.NumberFormatOptions),
    });
  }

  if (variableType === 'd') {
    const value = variableValue instanceof Date ? variableValue : undefined;
    if (value == null) return null;
    return gt
      .formatDateTime(value, {
        locales,
        ...(variableOptions as Intl.DateTimeFormatOptions),
      })
      .replace(/[\u200F\u202B\u202E]/g, '');
  }

  if (variableType === 'c') {
    const value =
      typeof variableValue === 'string' || typeof variableValue === 'number'
        ? variableValue
        : variableValue == null
          ? variableValue
          : undefined;
    if (value == null) return null;
    const options = variableOptions as CurrencyOptions | undefined;
    return gt.formatCurrency(
      typeof value === 'string' ? parseFloat(value) : value,
      options?.currency ?? 'USD',
      { locales, ...options }
    );
  }

  if (variableType === 'rt') {
    const options = variableOptions as RelativeTimeFormatOptions | undefined;
    if (typeof variableValue === 'number' && options?.unit) {
      return gt.formatRelativeTime(variableValue, options.unit, {
        locales,
        numeric: options.numeric,
        style: options.style,
        localeMatcher: options.localeMatcher,
      });
    }
    const dateValue =
      variableValue instanceof Date
        ? variableValue
        : typeof variableValue === 'string' || typeof variableValue === 'number'
          ? new Date(variableValue)
          : undefined;
    if (!dateValue || isNaN(dateValue.getTime())) return null;
    return gt.formatRelativeTimeFromDate(dateValue, {
      locales,
      baseDate: options?.baseDate ?? new Date(),
      numeric: options?.numeric,
      style: options?.style,
      localeMatcher: options?.localeMatcher,
    });
  }

  return variableValue as ReactNode;
};

export { renderServerVariable };
