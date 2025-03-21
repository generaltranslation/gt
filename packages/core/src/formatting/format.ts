import { intlCache } from '../cache/IntlCache';
import { libraryDefaultLocale } from '../internal';

/**
 * Formats a number according to the specified locales and options.
 *
 * @param {Object} params - The parameters for the number formatting.
 * @param {number} params.value - The number to format.
 * @param {string | string[]} [params.locales=['en']] - The locales to use for formatting.
 * @param {Intl.NumberFormatOptions} [params.options={}] - Additional options for number formatting.
 *
 * @returns {string} The formatted number.
 * @internal
 */
export function _formatNum({
  value,
  locales = [libraryDefaultLocale],
  options = {},
}: {
  value: number;
  locales?: string | string[];
  options?: Intl.NumberFormatOptions;
}): string {
  const res = intlCache
    .get('NumberFormat', locales, {
      numberingSystem: 'latn',
      ...options,
    })
    .format(value);
  return res;
}

/**
 * Formats a date according to the specified locales and options.
 *
 * @param {Object} params - The parameters for the date formatting.
 * @param {Date} params.value - The date to format.
 * @param {string | string[]} [params.locales='en']] - The locales to use for formatting.
 * @param {Intl.DateTimeFormatOptions} [params.options={}] - Additional options for date formatting.
 *
 * @returns {string} The formatted date.
 * @internal
 */
export function _formatDateTime({
  value,
  locales = [libraryDefaultLocale],
  options = {},
}: {
  value: Date;
  locales?: string | string[];
  options?: Intl.DateTimeFormatOptions;
}): string {
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
 * @param {string | string[]} [params.locales=['en']] - The locales to use for formatting.
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
}: {
  value: number;
  currency?: string;
  locales?: string | string[];
  options?: Intl.NumberFormatOptions;
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
 * @param {string | string[]} [params.locales=['en']] - The locales to use for formatting.
 * @param {Intl.ListFormatOptions} [params.options={}] - Additional options for list formatting.
 *
 * @returns {string} The formatted list.
 * @internal
 */
export function _formatList({
  value,
  locales = [libraryDefaultLocale],
  options = {},
}: {
  value: Array<any>;
  locales?: string | string[];
  options?: Intl.ListFormatOptions;
}): string {
  return intlCache
    .get('ListFormat', locales, {
      type: 'conjunction', // Default type, can be overridden via options
      style: 'long', // Default style, can be overridden via options
      ...options,
    })
    .format(value);
}

/**
 * Formats a relative time value according to the specified locales and options.
 *
 * @param {Object} params - The parameters for the relative time formatting.
 * @param {number} params.value - The relative time value to format.
 * @param {Intl.RelativeTimeFormatUnit} params.unit - The unit of time (e.g., 'second', 'minute', 'hour', 'day', 'week', 'month', 'year').
 * @param {string | string[]} [params.locales=['en']] - The locales to use for formatting.
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
}: {
  value: number;
  unit: Intl.RelativeTimeFormatUnit;
  locales?: string | string[];
  options?: Intl.RelativeTimeFormatOptions;
}): string {
  return intlCache
    .get('RelativeTimeFormat', locales, {
      style: 'long',
      numeric: 'auto',
      ...options,
    })
    .format(value, unit);
}
