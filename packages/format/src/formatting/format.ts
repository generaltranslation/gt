import { FormatVariables } from '../types';
import { intlCache } from '../cache/IntlCache';
import { libraryDefaultLocale } from '../settings/settings';
import { formatMessage } from '@generaltranslation/icu';

type FormatParams<Value, Options> = {
  value: Value;
  locales?: string | string[];
  options?: Options;
};

/**
 * Formats a message according to the specified locales and options.
 *
 * @param {string} message - The message to format.
 * @param {string | string[]} [locales=libraryDefaultLocale] - The locales to use for formatting.
 * @param {Record<string, any>} [variables={}] - The variables to use for formatting.
 * @returns {string} The formatted message.
 * @internal
 */
export function _formatMessageICU(
  message: string,
  locales: string | string[] = libraryDefaultLocale,
  variables: FormatVariables = {}
): string {
  // Preserve the previous IntlMessageFormat wrapper behavior for truthy
  // non-string arguments such as booleans and Dates.
  return (
    (formatMessage(message, locales, variables) as unknown)?.toString() ?? ''
  );
}

/**
 * Formats a number according to the specified locales and options.
 *
 * @param {Object} params - The parameters for the number formatting.
 * @param {number} params.value - The number to format.
 * @param {string | string[]} [params.locales=[libraryDefaultLocale]] - The locales to use for formatting.
 * @param {Intl.NumberFormatOptions} [params.options={}] - Additional options for number formatting.
 *
 * @returns {string} The formatted number.
 * @internal
 */
export function _formatNum({
  value,
  locales = [libraryDefaultLocale],
  options = {},
}: FormatParams<number, Intl.NumberFormatOptions>): string {
  return intlCache
    .get('NumberFormat', locales, {
      numberingSystem: 'latn',
      ...options,
    })
    .format(value);
}

/**
 * Formats a date according to the specified locales and options.
 *
 * @param {Object} params - The parameters for the date formatting.
 * @param {Date} params.value - The date to format.
 * @param {string | string[]} [params.locales=libraryDefaultLocale] - The locales to use for formatting.
 * @param {Intl.DateTimeFormatOptions} [params.options={}] - Additional options for date formatting.
 *
 * @returns {string} The formatted date.
 * @internal
 */
export function _formatDateTime({
  value,
  locales = [libraryDefaultLocale],
  options = {},
}: FormatParams<Date, Intl.DateTimeFormatOptions>): string {
  return intlCache
    .get('DateTimeFormat', locales, {
      calendar: 'gregory',
      numberingSystem: 'latn',
      ...options,
    })
    .format(value);
}

/**
 * Formats a currency value according to the specified locales, currency, and options.
 *
 * @param {Object} params - The parameters for the currency formatting.
 * @param {number} params.value - The currency value to format.
 * @param {string} params.currency - The currency code (e.g., 'USD').
 * @param {string | string[]} [params.locales=[libraryDefaultLocale]] - The locales to use for formatting.
 * @param {Intl.NumberFormatOptions} [params.options={}] - Additional options for currency formatting.
 *
 * @returns {string} The formatted currency value.
 * @internal
 */

export function _formatCurrency({
  value,
  locales = [libraryDefaultLocale],
  currency = 'USD',
  options = {},
}: FormatParams<number, Intl.NumberFormatOptions> & {
  value: number;
  currency?: string;
}): string {
  return intlCache
    .get('NumberFormat', locales, {
      style: 'currency',
      currency,
      numberingSystem: 'latn',
      ...options,
    })
    .format(value);
}

/**
 * Formats a list of items according to the specified locales and options.
 *
 * @param {Object} params - The parameters for the list formatting.
 * @param {Array<string | number>} params.value - The list of items to format.
 * @param {string | string[]} [params.locales=[libraryDefaultLocale]] - The locales to use for formatting.
 * @param {Intl.ListFormatOptions} [params.options={}] - Additional options for list formatting.
 *
 * @returns {string} The formatted list.
 * @internal
 */
export function _formatList({
  value,
  locales = [libraryDefaultLocale],
  options = {},
}: FormatParams<Array<string | number>, Intl.ListFormatOptions>): string {
  return intlCache
    .get('ListFormat', locales, {
      type: 'conjunction', // Default type, can be overridden via options
      style: 'long', // Default style, can be overridden via options
      ...options,
    })
    .format(value.map(String));
}

/**
 * Formats a list of items according to the specified locales and options.
 * @param {Object} params - The parameters for the list formatting.
 * @param {Array<T>} params.value - The list of items to format.
 * @param {string | string[]} [params.locales=[libraryDefaultLocale]] - The locales to use for formatting.
 * @param {Intl.ListFormatOptions} [params.options={}] - Additional options for list formatting.
 * @returns {Array<T | string>} The formatted list parts.
 * @internal
 */
export function _formatListToParts<T>({
  value,
  locales = [libraryDefaultLocale],
  options = {},
}: FormatParams<Array<T>, Intl.ListFormatOptions>) {
  const formatListParts = intlCache
    .get('ListFormat', locales, {
      type: 'conjunction', // Default type, can be overridden via options
      style: 'long', // Default style, can be overridden via options
      ...options,
    })
    .formatToParts(value.map(() => '1'));
  let partIndex = 0;
  return formatListParts.map((part) => {
    if (part.type === 'element') return value[partIndex++];
    return part.value;
  });
}

/**
 * Selects the best unit and computes the value for relative time formatting
 * based on the difference between a date and a base date.
 * @param {Date} date - The target date.
 * @param {Date} baseDate - The base date to compute relative time from. Must be provided by the caller for hydration safety.
 * @returns {{ value: number, unit: Intl.RelativeTimeFormatUnit }} The computed value and unit.
 * @internal
 */
export function _selectRelativeTimeUnit(
  date: Date,
  baseDate: Date
): {
  value: number;
  unit: Intl.RelativeTimeFormatUnit;
} {
  const now = baseDate.getTime();
  const diffMs = date.getTime() - now;
  const absDiffMs = Math.abs(diffMs);
  const sign = diffMs < 0 ? -1 : 1;

  // Use Math.floor to avoid confusing jumps near boundaries
  // (e.g. 3.5 days rounding to "1 week ago" instead of "3 days ago")
  const seconds = Math.floor(absDiffMs / 1000);
  const minutes = Math.floor(absDiffMs / (1000 * 60));
  const hours = Math.floor(absDiffMs / (1000 * 60 * 60));
  const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(absDiffMs / (1000 * 60 * 60 * 24 * 7));
  const months = Math.floor(absDiffMs / (1000 * 60 * 60 * 24 * 30));
  const years = Math.floor(absDiffMs / (1000 * 60 * 60 * 24 * 365));

  if (seconds < 60) return { value: sign * seconds, unit: 'second' };
  if (minutes < 60) return { value: sign * minutes, unit: 'minute' };
  if (hours < 24) return { value: sign * hours, unit: 'hour' };
  if (days < 7) return { value: sign * days, unit: 'day' };
  if (days < 28) return { value: sign * weeks, unit: 'week' };
  if (months < 1) return { value: sign * weeks, unit: 'week' };
  if (months < 12) return { value: sign * months, unit: 'month' };
  if (years < 1) return { value: sign * months, unit: 'month' };
  return { value: sign * years, unit: 'year' };
}

/**
 * Formats a relative time value according to the specified locales and options.
 *
 * @param {Object} params - The parameters for the relative time formatting.
 * @param {number} params.value - The relative time value to format.
 * @param {Intl.RelativeTimeFormatUnit} params.unit - The unit of time (e.g., 'second', 'minute', 'hour', 'day', 'week', 'month', 'year').
 * @param {string | string[]} [params.locales=[libraryDefaultLocale]] - The locales to use for formatting.
 * @param {Intl.RelativeTimeFormatOptions} [params.options={}] - Additional options for relative time formatting.
 *
 * @returns {string} The formatted relative time string.
 * @internal
 */
export function _formatRelativeTime({
  value,
  unit,
  locales = [libraryDefaultLocale],
  options = {},
}: FormatParams<number, Intl.RelativeTimeFormatOptions> & {
  unit: Intl.RelativeTimeFormatUnit;
}): string {
  return intlCache
    .get('RelativeTimeFormat', locales, {
      style: 'long',
      numeric: 'auto',
      ...options,
    })
    .format(value, unit);
}
