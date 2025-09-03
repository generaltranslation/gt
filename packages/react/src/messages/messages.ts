import { formatMessage } from 'generaltranslation';
import { hashSource } from 'generaltranslation/id';
import { InlineTranslationOptions } from '../types/types';
import { libraryDefaultLocale } from 'generaltranslation/internal';

export function icuMessageContainsVariables(message: string): boolean {
  // ICU uses apostrophes as escape characters
  // To include a literal apostrophe, it must be doubled ('')
  // We need to check for unescaped braces while accounting for escaped apostrophes

  let i = 0;
  let inQuotes = false;

  while (i < message.length) {
    const char = message[i];

    if (char === "'") {
      // Check if this is an escaped apostrophe
      if (i + 1 < message.length && message[i + 1] === "'") {
        // Skip both characters (escaped apostrophe)
        i += 2;
        continue;
      }
      // Single apostrophe - toggle quote state
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    // Only process braces when not in quotes
    if (!inQuotes && char === '{') {
      // Look for the matching closing brace
      let j = i + 1;
      let braceContent = '';

      while (j < message.length && message[j] !== '}') {
        braceContent += message[j];
        j++;
      }

      // If we found a closing brace and there's content between them
      if (j < message.length && braceContent.trim().length > 0) {
        return true;
      }

      // Move past the closing brace (or continue if no closing brace found)
      i = j < message.length ? j + 1 : j;
      continue;
    }

    i++;
  }

  return false;
}

/**
 * Encodes content into a message that contains important translation metadata
 * @param message The message to encode.
 * @param options The options to encode.
 * @returns The same message, or an encoded message if the string contains interpolated values
 * 
 * @description - This function is used to register a message for translation.
 * 
 * @example - Uninterpolated usage
 * 
 * ```jsx
 * import { msg } from 'gt-react';
 * const message = msg('Hello, world!');
 * console.log(message); // "Hello, world!"
 * ```
 * 
 * Use the `m()` function from `useMessages()` to translate the message.
 * ```jsx
 * import { useMessages } from 'gt-react';
 * const m = useMessages();
 * console.log(m(message)); // "Bonjour, le monde!" (in French)
 * ```
 *
 * @example - Interpolated usage
 *
 * ```jsx
 * import { msg } from 'gt-react';
 * const message = msg('Hello, {name}!', { name: 'Brian' });
 * console.log(message); // "Hello, Brian:eyIkX2hhc2giOiAiMHgxMjMiLCAiJF9zb3VyY2UiOiAiSGVsbG8sIHtuYW1lfSEiLCAibmFtZSI6ICJCcmlhbiJ9"
 * ```
 * eyIkX2hhc2giOiAiMHgxMjMiLCAiJF9zb3VyY2UiOiAiSGVsbG8sIHtuYW1lfSEiLCAibmFtZSI6ICJCcmlhbiJ9
 * encodes to {"$_hash": "0x123", "$_source": "Hello, {name}!", "name": "Brian"}
 * 
 * Use the `m()` function from `useMessages()` to translate the message.
 * ```jsx
 * import { useMessages } from 'gt-react';
 * const m = useMessages();
 * console.log(m(message)); // "Bonjour, Brian!" (in French)
 * ```
 * 
 * Use the decodeMsg() function to get just the interpolated message.
 * ```jsx
 * import { decodeMsg } from 'gt-react';
 * console.log(decodeMsg(message)); // "Hello, Brian!"
 * ```
 *
 *
 * @note - Interpolated Message format
 * A message is broken into two parts separated by colons:
 * - interpolated content - the content with interpolated variables
 * - hash + options - a unique identifier for the source content and options for the translation
 
 */
export function msg(
  message: string,
  options?: InlineTranslationOptions
): string {
  // Skip encoding uninterpolated messages (or keys only including $_hash from compiler)
  if (!options || Object.keys(options).every((key) => key === '$_hash')) {
    return message;
  }

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
  } else {
    options = { $_hash: hash };
  }

  // get the options encoding
  const optionsEncoding = Buffer.from(JSON.stringify(options)).toString(
    'base64'
  );

  // Interpolated string
  let interpolatedString = message;
  if (
    icuMessageContainsVariables(message) &&
    Object.keys(options || {}).length > 2 // $_hash and $_source are not variables
  ) {
    interpolatedString = formatMessage(message, {
      locales: [libraryDefaultLocale], // TODO: use compiler to insert locales
      variables: options,
    });
  }

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
  // Check if message is encoded
  const isEncoded = encodedMsg.lastIndexOf(':') !== -1;

  // Return if message is not encoded
  if (!isEncoded) {
    return encodedMsg;
  }

  // Interpolate string
  const message = encodedMsg.slice(0, encodedMsg.lastIndexOf(':'));
  const options = decodeOptions(encodedMsg);
  let interpolatedString = message;
  if (options && Object.keys(options).length > 1) {
    interpolatedString = formatMessage(message, {
      locales: [libraryDefaultLocale], // TODO: use compiler to insert locales
      variables: options,
    });
  }
  return interpolatedString;
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
