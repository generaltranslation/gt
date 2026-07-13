import { decode } from 'generaltranslation/internal';
import type { TranslationOptions } from '../types/options';

/**
 * Decodes the options from an encoded message.
 * @param encodedMsg The message to decode.
 * @returns The decoded options.
 */
export function decodeOptions(encodedMsg: string): TranslationOptions | null {
  if (encodedMsg.lastIndexOf(':') === -1) {
    return null;
  }

  // Extract encoded options
  const optionsEncoding = encodedMsg.slice(encodedMsg.lastIndexOf(':') + 1);

  try {
    // Parse options
    const options = JSON.parse(decode(optionsEncoding));
    return options;
  } catch {
    return null;
  }
}
