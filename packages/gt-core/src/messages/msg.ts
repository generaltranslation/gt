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
 * const message = msg('Hello, {name}!');
 * console.log(message); // "Hello, {name}!"
 * ```
 *
 * @example - Usage with options
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

  // Add source to options
  options.$_source = message;

  // Add hash to options
  options.$_hash ||= hashSource({
    source: message,
    ...(options?.$context && { context: options.$context }),
    ...(options?.$id && { id: options.$id }),
    dataFormat: 'ICU',
  });

  // Interpolated string
  let interpolatedString: string = message;
  if (
    icuMessageContainsVariables(message) &&
    Object.keys(options || {}).length > 2 // $_hash and $_source are not variables
  ) {
    try {
      interpolatedString = formatMessage(message, {
        locales: [libraryDefaultLocale], // TODO: use compiler to insert locales
        variables: options,
      });
    } catch (error) {
      console.warn(msgStringFormatWarning(message), 'Error: ', error);
      return message;
    }
  }

  // get the options encoding
  const optionsEncoding = encode(JSON.stringify(options));

  // Construct result
  return `${interpolatedString}:${optionsEncoding}`;
}
