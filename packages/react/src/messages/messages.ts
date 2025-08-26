import { InlineTranslationOptions } from '../types/types';

class Msg {
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
  static encode(content: string, options?: InlineTranslationOptions): string {
    throw new Error('Not implemented');
  }

  /**
   * Extracts the original interpolated content from a message.
   * @param message The message to decode.
   * @returns The decoded message.
   */
  static decode(content: string): string {
    throw new Error('Not implemented');
  }
}

export default Msg;
