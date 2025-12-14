import { EncodedTranslationOptions, InlineTranslationOptions } from '../types';
import { hashSource } from 'generaltranslation/id';
import { icuMessageContainsVariables } from './utils/icuMessageContainsVariables';
import { formatMessage } from 'generaltranslation';
import {
  encode,
  libraryDefaultLocale,
  indexVars,
  VAR_IDENTIFIER,
} from 'generaltranslation/internal';
import { interpolationFailureWarning } from '../logs/warnings';
import logger from '../logs/logger';
import { extractVariables } from '../utils/extractVariables';

/**
 * Registers a message to be translated. Returns the message unchanged if no options are provided.
 * @param message The message to encode.
 * @param options The options to encode.
 * @returns The encoded message.
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
 * ```jsx
 * import { msg } from 'gt-i18n';
 * const message1 = msg('Hello, World!');
 * console.log(message1); // "Hello, World!"
 * const message2 = msg('Hello, {name}!', { name: 'Brian' });
 * console.log(message2); // "Hello, Brian:eyIkX2hhc2giOiAiMHgxMjMiLCAiJF9zb3VyY2UiOiAiSGVsbG8sIHtuYW1lfSEiLCAibmFtZSI6ICJCcmlhbiJ9"
 * ```
 * eyIkX2hhc2giOiAiMHgxMjMiLCAiJF9zb3VyY2UiOiAiSGVsbG8sIHtuYW1lfSEiLCAibmFtZSI6ICJCcmlhbiJ9
 * encodes to {"$_hash": "0x123", "$_source": "Hello, {name}!", "name": "Brian"}
 */
export function msg<T extends string>(message: T): T;
export function msg<T extends string>(
  message: T,
  options: InlineTranslationOptions
): string;
export function msg<T extends string>(
  message: T,
  options?: InlineTranslationOptions
): T | string {
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
    logger.warn(interpolationFailureWarning + ' Error: ' + error);
    return message;
  }

  // Encode options
  const $_source = message;
  const $_hash =
    options.$_hash ||
    hashSource({
      source: indexVars(message),
      ...(options?.$context && { context: options.$context }),
      ...(options?.$id && { id: options.$id }),
      dataFormat: 'ICU',
    });
  const encodedOptions: EncodedTranslationOptions = {
    ...options,
    $_source,
    $_hash,
  };
  const optionsEncoding = encode(JSON.stringify(encodedOptions));

  // Construct result
  return `${interpolatedString}:${optionsEncoding}`;
}
