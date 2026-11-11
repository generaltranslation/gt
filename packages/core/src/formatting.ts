import {
  formatCurrency as _formatCurrency,
  formatCutoff as _formatCutoff,
  formatDateTime as _formatDateTime,
  formatList as _formatList,
  formatListToParts as _formatListToParts,
  formatMessage as _formatMessage,
  formatNum as _formatNum,
  formatRelativeTime as _formatRelativeTime,
  formatRelativeTimeFromDate as _formatRelativeTimeFromDate,
} from '@generaltranslation/format';
import {
  formatMessageTree as _formatMessageTree,
  type FormatMessageTreeOptions,
  type MessageTree,
  type MessageTreeValues,
} from '@generaltranslation/icu';
import { libraryDefaultLocale } from './settings/settings';
import { hostTimeZone } from './utils/hostTimeZone';

// `@generaltranslation/format` and `@generaltranslation/icu` take every
// argument: they apply no defaults and read neither the host's time zone nor
// the clock. These are the same functions for a caller, who may leave out
// what is resolved here: the locales, a message's values, the time zone and
// the date to compare with. Nothing outside this package resolves them.
export type WithOptional<Options, Keys extends keyof Options> = Omit<
  Options,
  Keys
> &
  Partial<Pick<Options, Keys>>;

type Options<
  Formatter extends (...args: never[]) => unknown,
  Index extends number,
  Keys extends keyof Parameters<Formatter>[Index] = never,
> = WithOptional<Parameters<Formatter>[Index], Keys | 'locales'>;

const withLocales = <Given extends { locales?: string | string[] }>(
  options: Given | undefined
) => ({ ...options, locales: options?.locales ?? libraryDefaultLocale });

/**
 * Formats a number according to the specified locales and options.
 *
 * @param {number} number - The number to format.
 * @param {Object} [options] - `Intl.NumberFormat` options, and `locales`.
 * @returns {string} The formatted number.
 *
 * @example
 * formatNum(1234.5, { locales: 'de' }); // "1.234,5"
 */
export function formatNum(
  number: number,
  options?: Options<typeof _formatNum, 1>
): string {
  return _formatNum(number, withLocales(options));
}

/**
 * Formats a date according to the specified locales and options.
 *
 * @param {Date} date - The date to format.
 * @param {Object} [options] - `Intl.DateTimeFormat` options, and `locales`.
 * The `timeZone` defaults to the host's.
 * @returns {string} The formatted date.
 *
 * @example
 * formatDateTime(new Date(), { dateStyle: 'full', timeZone: 'Asia/Tokyo' });
 */
export function formatDateTime(
  date: Date,
  options?: Options<typeof _formatDateTime, 1, 'timeZone'>
): string {
  return _formatDateTime(date, {
    ...withLocales(options),
    timeZone: options?.timeZone ?? hostTimeZone(),
  });
}

/**
 * Formats a currency value according to the specified locales and options.
 *
 * @param {number} value - The currency value to format.
 * @param {string} currency - The currency code, such as 'USD'.
 * @param {Object} [options] - `Intl.NumberFormat` options, and `locales`.
 * @returns {string} The formatted currency value.
 *
 * @example
 * formatCurrency(5, 'EUR', { locales: 'en-US' }); // "€5.00"
 */
export function formatCurrency(
  value: number,
  currency: string,
  options?: Options<typeof _formatCurrency, 2>
): string {
  return _formatCurrency(value, currency, withLocales(options));
}

/**
 * Formats a list of items according to the specified locales and options.
 *
 * @param {Array<string | number>} array - The list of items to format.
 * @param {Object} [options] - `Intl.ListFormat` options, and `locales`.
 * @returns {string} The formatted list.
 *
 * @example
 * formatList(['a', 'b', 'c']); // "a, b, and c"
 */
export function formatList(
  array: Array<string | number>,
  options?: Options<typeof _formatList, 1>
): string {
  return _formatList(array, withLocales(options));
}

/**
 * Formats a list of items into parts: the items as given, and the text
 * between them.
 *
 * @param {Array<T>} array - The list of items to format.
 * @param {Object} [options] - `Intl.ListFormat` options, and `locales`.
 * @returns {Array<T | string>} The items and the text between them.
 *
 * @example
 * formatListToParts([1, 2]); // [1, " and ", 2]
 */
export function formatListToParts<T>(
  array: Array<T>,
  options?: Options<typeof _formatListToParts, 1>
): Array<T | string> {
  return _formatListToParts(array, withLocales(options));
}

/**
 * Formats a relative time value according to the specified locales and
 * options.
 *
 * @param {number} value - The relative time value to format.
 * @param {Intl.RelativeTimeFormatUnit} unit - The unit of time, such as 'day'.
 * @param {Object} [options] - `Intl.RelativeTimeFormat` options, and
 * `locales`.
 * @returns {string} The formatted relative time.
 *
 * @example
 * formatRelativeTime(-1, 'day'); // "yesterday"
 */
export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options?: Options<typeof _formatRelativeTime, 2>
): string {
  return _formatRelativeTime(value, unit, withLocales(options));
}

/**
 * Formats a date as relative time from now, or from `baseDate`, picking the
 * unit that fits.
 *
 * @param {Date} date - The date to format.
 * @param {Object} [options] - `Intl.RelativeTimeFormat` options, `locales`,
 * and the `baseDate` to compare with, which defaults to now.
 * @returns {string} The formatted relative time, such as "2 hours ago".
 *
 * @example
 * formatRelativeTimeFromDate(new Date(Date.now() - 3600000)); // "1 hour ago"
 */
export function formatRelativeTimeFromDate(
  date: Date,
  options?: Options<typeof _formatRelativeTimeFromDate, 1, 'baseDate'>
): string {
  return _formatRelativeTimeFromDate(date, {
    ...withLocales(options),
    baseDate: options?.baseDate ?? new Date(),
  });
}

/**
 * Cuts a string to a number of characters, with a terminator such as an
 * ellipsis.
 *
 * @param {string} value - The string to cut.
 * @param {Object} [options] - `maxChars`, `style`, `terminator`, `separator`,
 * and `locales`.
 * @returns {string} The string, cut when it is longer than `maxChars`.
 *
 * @example
 * formatCutoff('Hello, world!', { maxChars: 8 }); // "Hello, …"
 */
export function formatCutoff(
  value: string,
  options?: Options<typeof _formatCutoff, 1>
): string {
  return _formatCutoff(value, withLocales(options));
}

/**
 * Formats an ICU message according to the specified locales and options.
 *
 * @param {string} message - The message to format.
 * @param {Object} [options] - `locales`, `variables` and `dataFormat`; when
 * `dataFormat` is `STRING` the message is returned as is. The `timeZone` of
 * its dates and times defaults to the host's.
 * @returns {string} The formatted message.
 *
 * @example
 * formatMessage('Hello {name}', { variables: { name: 'John' } });
 * // Returns: "Hello John"
 */
export function formatMessage(
  message: string,
  options?: Options<typeof _formatMessage, 1, 'variables' | 'timeZone'>
): string {
  return _formatMessage(message, {
    ...withLocales(options),
    variables: options?.variables ?? {},
    timeZone: options?.timeZone ?? hostTimeZone(),
  });
}

/**
 * Formats a message tree according to the specified locales and options.
 *
 * @param {MessageTree} tree - The message tree to format.
 * @param {string | string[]} [locales] - The locales to use for formatting.
 * @param {Object} [values] - The values of the tree's variables.
 * @param {Object} [options] - What the tree is formatted with. The
 * `timeZone` of its dates and times defaults to the host's.
 * @returns The formatted message: a string, or the parts around rich values.
 */
export function formatMessageTree(
  tree: MessageTree,
  locales: string | string[] = libraryDefaultLocale,
  values: MessageTreeValues<unknown> = {},
  options?: WithOptional<FormatMessageTreeOptions, 'timeZone'>
): unknown {
  return _formatMessageTree<unknown>(tree, locales, values, {
    ...options,
    timeZone: options?.timeZone ?? hostTimeZone(),
  });
}
