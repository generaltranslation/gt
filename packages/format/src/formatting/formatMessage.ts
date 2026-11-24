import { formatIcu } from '@generaltranslation/icu/parser';
import type { FormatVariables } from '../types-dir/types';
import type { StringFormat } from '../types-dir/jsx/content';

type MessageFormatOptions = {
  locales: string | string[];
  variables: FormatVariables;
  dataFormat?: StringFormat;
  /** The time zone of the dates and times in the message. */
  timeZone: string;
};

/**
 * Formats a message according to the specified locales and options.
 *
 * @param {string} message - The message to format.
 * @param {Object} [options] - Configuration options for message formatting.
 * @param {string | string[]} [options.locales] - The locales to use for formatting.
 * @param {FormatVariables} [options.variables] - The variables to use for formatting.
 * @param {StringFormat} [options.dataFormat='ICU'] - The format of the message. When STRING, the message is returned as is.
 * @param {string} options.timeZone - The time zone of the dates and times in the message.
 * @returns {string} The formatted message.
 *
 * @example
 * formatMessage('Hello {name}', { variables: { name: 'John' }, timeZone: 'UTC' });
 * // Returns: "Hello John"
 */
export function formatMessage(message: string, options: MessageFormatOptions) {
  if (options.dataFormat === 'STRING') return message;
  return formatIcu(message, options.locales, options.variables, {
    timeZone: options.timeZone,
  });
}
