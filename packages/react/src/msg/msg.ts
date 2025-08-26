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
   * @note - Escape characters
   * Because the single quote is used as a separator, it will be escaped with a backslash.
   * Additionally, the backslash itself will be escaped with a backslash.
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
   * @example - Escape characters
   * ```jsx
   * import { Msg } from 'gt-react';
   * const message1 = Msg.encode("Hello: '{name}'!", { name: 'Archie' });
   * console.log(message); // "0x123:'Hello: \'Archie\'':?name='Archie'"
   *
   * const message2 = Msg.encode('Hello\\ {name}!', { name: 'Archie' });
   * console.log(message2); // "0x123:'Hello\\\\ {name}!':?name='Archie'"
   * ```
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
