import { formatMessage as _formatMessage } from '@generaltranslation/format';
import { hostTimeZone } from '../utils/hostTimeZone';
import { type Options, withLocales } from './formatting';

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
