import { FormatVariables, I18nextMessage } from '../types';
import { intlCache } from '../cache/IntlCache';
import { libraryDefaultLocale } from '../internal';
import IntlMessageFormat from 'intl-messageformat';
import { formatI18nextWarning, formatJsxWarning } from '../logging/warnings';
import { formattingLogger } from '../logging/logger';
import { JsxChildren } from '../types';
import {
  CutoffFormatOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  CutoffFormatStyle,
} from './custom-formats/CutoffFormat/types';

/**
 * Formats a string value with cutoff behavior according to the specified locales and options.
 *
 * @param {Object} params - The parameters for the cutoff formatting.
 * @param {string} params.value - The string value to format with cutoff behavior.
 * @param {string | string[]} [params.locales='en'] - The locales to use for formatting.
 * @param {CutoffFormatOptions} [params.options={}] - Additional options for cutoff formatting.
 * @param {number} [params.options.maxChars] - The maximum number of characters to display.
 * @param {CutoffFormatStyle} [params.options.style='ellipsis'] - The style of the terminator.
 * @param {string} [params.options.terminator] - Optional override for the terminator to use.
 * @param {string} [params.options.separator] - Optional override for the separator between terminator and value.
 *
 * @returns {string} The formatted string with terminator applied if cutoff occurs.
 * @internal
 *
 * @example
 * _formatCutoff({ value: 'Hello, world!', options: { maxChars: 8 } }); // Returns 'Hello, w...'
 *
 * Will fallback to an empty string if formatting fails.
 */
export function _formatCutoff({
  value,
  locales = libraryDefaultLocale,
  options = {},
}: {
  value: string;
  locales?: string | string[];
  options?: CutoffFormatOptions;
}): string {
  return intlCache.get('CutoffFormat', locales, options).format(value);
}

/**
 * Formats a message according to the specified locales and options.
 *
 * @param {string} message - The message to format.
 * @param {string | string[]} [locales='en'] - The locales to use for formatting.
 * @param {Record<string, any>} [variables={}] - The variables to use for formatting.
 * @returns {string} The formatted message.
 * @internal
 *
 * Will fallback to an empty string
 * TODO: add this to custom formats
 */
export function _formatMessageICU(
  message: string,
  locales: string | string[] = libraryDefaultLocale,
  variables: FormatVariables = {}
): string {
  const messageFormat = new IntlMessageFormat(message, locales);
  return messageFormat.format(variables)?.toString() ?? '';
}

/**
 * Returns the message as-is without any formatting.
 *
 * @param {string} message - The message to return.
 * @returns {string} The original message, unchanged.
 * @internal
 *
 * TODO: add this to custom formats
 */
export function _formatMessageString(message: string): string {
  return message;
}

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
 * @param {string | string[]} [params.locales='en'] - The locales to use for formatting.
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
 * Formats a list of items according to the specified locales and options.
 * @param {Object} params - The parameters for the list formatting.
 * @param {Array<T>} params.value - The list of items to format.
 * @param {string | string[]} [params.locales=['en']] - The locales to use for formatting.
 * @param {Intl.ListFormatOptions} [params.options={}] - Additional options for list formatting.
 * @returns {Array<T | string>} The formatted list parts.
 * @internal
 */
export function _formatListToParts<T>({
  value,
  locales = [libraryDefaultLocale],
  options = {},
}: {
  value: Array<T>;
  locales?: string | string[];
  options?: Intl.ListFormatOptions;
}) {
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
/**
 * Selects the best unit and computes the value for relative time formatting
 * based on the difference between a date and now.
 * @internal
 */
export function _selectRelativeTimeUnit(date: Date, baseDate: Date = new Date()): {
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
  if (months < 12) return { value: sign * months, unit: 'month' };
  return { value: sign * years, unit: 'year' };
}

/**
 * Formats a relative time from a Date, automatically selecting the best unit.
 * @internal
 */
export function _formatRelativeTimeFromDate({
  date,
  baseDate,
  locales = [libraryDefaultLocale],
  options = {},
}: {
  date: Date;
  baseDate?: Date;
  locales?: string | string[];
  options?: Intl.RelativeTimeFormatOptions;
}): string {
  const { value, unit } = _selectRelativeTimeUnit(date, baseDate);
  return _formatRelativeTime({ value, unit, locales, options });
}

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

/**
 * @experimental This function is not currently supported but will be implemented in a future version.
 * Use {@link _formatMessageICU} for current ICU message format support.
 * Formats an I18next message according to the specified locales and options.
 *
 * @param message - The I18next message to format.
 * @param variables - The variables to use for formatting.
 * @returns The formatted I18next message.
 * @internal
 */
export function _formatI18next(
  message: I18nextMessage,
  // eslint-disable-next-line no-unused-vars
  _variables: FormatVariables = {}
): string {
  formattingLogger.warn(formatI18nextWarning);
  return message;
}

/**
 * @experimental This function is not currently supported but will be implemented in a future version.
 * Use {@link _formatMessageICU} for current ICU message format support.
 * Formats a JSX message according to the specified locales and options.
 *
 * @param message - The JSX message to format.
 * @param variables - The variables to use for formatting.
 * @returns The formatted JSX message.
 * @internal
 */
export function _formatJsx(
  message: JsxChildren,
  // eslint-disable-next-line no-unused-vars
  _variables: FormatVariables = {}
): JsxChildren {
  formattingLogger.warn(formatJsxWarning);
  return message;
}
