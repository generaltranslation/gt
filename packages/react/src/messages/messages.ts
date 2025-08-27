import { formatMessage } from 'generaltranslation';
import { hashSource } from 'generaltranslation/id';
import { InlineTranslationOptions } from '../types/types';
import { libraryDefaultLocale } from 'generaltranslation/internal';

/**
 * Encodes content into a message that contains important translation metadata
 * @param message The message to encode.
 * @param options The options to encode.
 * @returns The encoded message.
 *
 * @note - Message format
 * A message is broken into two parts separated by colons:
 * - interpolated content - the content with interpolated variables
 * - hash + options - a unique identifier for the source content and options for the translation
 *
 * @example - Basic usage
 *
 * ```jsx
 * import { msg } from 'gt-react';
 * const message = msg('Hello, {name}!', { name: 'Brian' });
 * console.log(message); // "Hello, Brian:eyIkX2hhc2giOiAiMHgxMjMiLCAiJF9zb3VyY2UiOiAiSGVsbG8sIHtuYW1lfSEiLCAibmFtZSI6ICJCcmlhbiJ9"
 * ```
 * eyIkX2hhc2giOiAiMHgxMjMiLCAiJF9zb3VyY2UiOiAiSGVsbG8sIHtuYW1lfSEiLCAibmFtZSI6ICJCcmlhbiJ9
 * encodes to {"$_hash": "0x123", "$_source": "Hello, {name}!", "name": "Brian"}
 *
 */
export function msg(
  message: string,
  options?: InlineTranslationOptions
): string {
  // get hash
  const hash =
    options?.$_hash ||
    hashSource({
      source: message,
      ...(options?.$context && { context: options.$context }),
      ...(options?.$id && { id: options.$id }),
      dataFormat: 'ICU',
    });

  // Always add hash to options
  if (options) {
    options.$_hash = hash;
    options.$_source = message;
  } else {
    options = { $_hash: hash, $_source: message };
  }

  // get the options encoding
  const optionsEncoding = Buffer.from(JSON.stringify(options)).toString(
    'base64'
  );

  // Interpolated string
  const interpolatedString = formatMessage(message, {
    locales: [libraryDefaultLocale], // TODO: use compiler to insert locales
    variables: options,
  });

  // Construct result
  let result = interpolatedString;
  if (optionsEncoding) result += `:${optionsEncoding}`;

  return result;
}

/**
 * Extracts the original interpolated message string.
 * If the message cannot be decoded (i.e., it does not contain a colon separator),
 * the input is returned as-is.
 * @param encodedMsg The message to decode.
 * @returns The decoded message, or the input if it cannot be decoded.
 */
export function decodeMsg(encodedMsg: string): string {
  if (encodedMsg.lastIndexOf(':') !== -1) {
    return encodedMsg.slice(0, encodedMsg.lastIndexOf(':'));
  }
  return encodedMsg;
}

/**
 * Decodes the options from an encoded message.
 * @param encodedMsg The message to decode.
 * @returns The decoded options.
 */
export function decodeOptions(encodedMsg: string):
  | ({
      $_source: string;
      $_hash: string;
    } & InlineTranslationOptions)
  | null {
  if (encodedMsg.lastIndexOf(':') === -1) {
    return null;
  }

  // Extract encoded options
  const optionsEncoding = encodedMsg.slice(encodedMsg.lastIndexOf(':') + 1);

  try {
    // Parse options
    const options = JSON.parse(
      Buffer.from(optionsEncoding, 'base64').toString()
    );
    return options;
  } catch {
    return null;
  }
}
