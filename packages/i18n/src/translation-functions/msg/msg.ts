import type {
  EncodedTranslationOptions,
  InlineTranslationOptions,
} from '../types/options';
import { formatMessage } from 'generaltranslation';
import {
  encode,
  libraryDefaultLocale,
  VAR_IDENTIFIER,
} from 'generaltranslation/internal';
import { interpolationFailureMessage } from '../utils/messages';
import logger from '../../logs/logger';
import { extractVariables } from '../../utils/extractVariables';
import { hashMessage } from '../../utils/hashMessage';
import { RegisterableMessages } from '../types/message';

/**
 * Registers a message to be translated. Returns the message unchanged if no options are provided.
 * @param {string | string[]} message The message to encode.
 * @param {InlineTranslationOptions} [options] The options to encode.
 * @returns The message or array of messages.
 *
 * @note - This function registers the message before the build process. The actual translation does not
 * occur until the m() function is invoked.
 *
 * @note - Message format
 * A message is broken into two parts separated by colons:
 * - interpolated content - the content with interpolated variables
 * - hash + options - a unique identifier for the source content and options for the translation
 *
 * @example - Basic usage
 *
 * const message1 = msg('Hello, World!');
 * console.log(message1); // "Hello, World!"
 *
 * const message2 = msg('Hello, {name}!', { name: 'Brian' });
 * console.log(message2); // "Hello, Brian:eyIkX2hhc2giOiAiMHgxMjMiLCAiJF9zb3VyY2UiOiAiSGVsbG8sIHtuYW1lfSEiLCAibmFtZSI6ICJCcmlhbiJ9"
 *
 * @example - Array usage
 *
 * const messages = msg(['Hello, Alice!', 'Hello, Bob!']);
 * console.log(messages); // ["Hello, Alice!", "Hello, Bob!"]
 *
 * @example - When specifying an id for an array, each message will have a unique id of `${id}.${index}`
 * const messages = msg(['Hello, Alice!', 'Hello, Bob!'], { $id: 'greetings' });
 * // "Hello, Alice!" id: "greetings.0"
 * // "Hello, Bob!" id: "greetings.1"
 */
export function msg<T extends RegisterableMessages>(message: T): T;
export function msg<T extends RegisterableMessages>(
  message: T,
  options?: InlineTranslationOptions
): T extends string ? string : string[];
export function msg(
  message: RegisterableMessages,
  options?: InlineTranslationOptions
): RegisterableMessages {
  // Handle array
  if (typeof message !== 'string') {
    if (!options) return message;
    return message.map((m, i) =>
      msg(m, {
        ...options,
        ...(options.$id != null && { $id: `${options.$id}.${i}` }),
      })
    );
  }

  if (!options) {
    return message;
  }

  // Extract variables
  const variables = extractVariables(options);

  // Interpolate string
  let interpolatedString: string = message;
  try {
    interpolatedString = formatMessage(message, {
      locales: [libraryDefaultLocale], // TODO: use compiler to insert locales
      variables: {
        ...variables,
        [VAR_IDENTIFIER]: 'other',
      },
    });
  } catch (error) {
    logger.warn(interpolationFailureMessage + ' Error: ' + error);
    return message;
  }

  // Encode options
  const $_source = message;
  const $_hash = options.$_hash || hashMessage(message, options);

  const encodedOptions: EncodedTranslationOptions = {
    ...options,
    $_source,
    $_hash,
  };
  const optionsEncoding = encode(JSON.stringify(encodedOptions));

  // Construct result
  return `${interpolatedString}:${optionsEncoding}`;
}
