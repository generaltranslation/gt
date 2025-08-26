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
 * import { Msg } from 'gt-react';
 * const message = Msg.encode('Hello, {name}!', { name: 'Brian' });
 * console.log(message); // "Hello, Brian:eyIiOiIweDEyMyIsIm5hbWUiOiJCcmlhbiJ9"
 * ```
 * eyIiOiIweDEyMyIsIm5hbWUiOiJCcmlhbiJ9 encodes to {"$hash": "0x123", "name": "Brian"}
 *
 */
export function msg(
  content: string,
  options?: InlineTranslationOptions
): string {
  // get hash
  const hash =
    options?.$_hash ||
    hashSource({
      source: content,
      ...(options?.$context && { context: options.$context }),
      ...(options?.$id && { id: options.$id }),
      dataFormat: 'ICU',
    });

  // Always add hash to options
  if (options) {
    options.$_hash = hash;
  } else {
    options = { $_hash: hash };
  }

  // get the options encoding
  const optionsEncoding = Buffer.from(JSON.stringify(options)).toString(
    'base64'
  );

  // Interpolated string
  const interpolatedString = formatMessage(content, {
    locales: [libraryDefaultLocale], // TODO: use compiler to insert locales
    variables: options,
  });

  // Construct message
  const message =
    interpolatedString + (optionsEncoding ? `:${optionsEncoding}` : '');

  return message;
}

/**
 * Extracts the original interpolated content from a message.
 * @param message The message to decode.
 * @returns The decoded message.
 */
export function decodeMsg(content: string): string {
  return content.lastIndexOf(':') === -1
    ? content
    : content.slice(0, content.lastIndexOf(':'));
}

/**
 * Decodes the options from a message.
 * @param content The message to decode.
 * @returns The decoded options.
 */
export function decodeOptions(
  content: string
): InlineTranslationOptions | null {
  // Extract encoded options
  const optionsEncoding =
    content.lastIndexOf(':') === -1
      ? ''
      : content.slice(content.lastIndexOf(':') + 1);

  // If no options, return empty object
  if (!optionsEncoding) {
    return null;
  }

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
