import {
  formatDateTime as formatZonedDateTime,
  formatMessage as formatZonedMessage,
} from '@generaltranslation/format';
import { hostTimeZone } from './utils/hostTimeZone';

// `@generaltranslation/format` takes the time zone as an argument. Here it is
// optional, and the host's when left out.
type WithOptionalTimeZone<Options extends { timeZone: string }> = Omit<
  Options,
  'timeZone'
> & { timeZone?: string };

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
  options?: WithOptionalTimeZone<Parameters<typeof formatZonedDateTime>[1]>
): string {
  return formatZonedDateTime(date, {
    ...options,
    timeZone: options?.timeZone ?? hostTimeZone(),
  });
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
  options?: WithOptionalTimeZone<Parameters<typeof formatZonedMessage>[1]>
): string {
  return formatZonedMessage(message, {
    ...options,
    timeZone: options?.timeZone ?? hostTimeZone(),
  });
}
