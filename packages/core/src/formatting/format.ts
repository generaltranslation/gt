import { FormatVariables, I18nextMessage } from '../types';
import { intlCache } from '../cache/IntlCache';
import { libraryDefaultLocale } from '../internal';
import IntlMessageFormat from 'intl-messageformat';
import { formatI18nextWarning, formatJsxWarning } from '../logging/warnings';
import { formattingLogger } from '../logging/logger';
import { JsxChildren } from '../types';

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
 */
export function _formatMessage(
  message: string,
  locales: string | string[] = libraryDefaultLocale,
  variables: FormatVariables = {}
): string {
  const messageFormat = new IntlMessageFormat(message, locales);
  return messageFormat.format(variables)?.toString() ?? '';
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
 * Use {@link _formatMessage} for current ICU message format support.
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
 * Use {@link _formatMessage} for current ICU message format support.
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
