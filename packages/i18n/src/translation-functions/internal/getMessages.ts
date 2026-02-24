import { InlineResolveOptions } from '../types/options';
import { decodeOptions } from '../msg/decodeOptions';
import { isEncodedTranslationOptions } from '../utils/isEncodedTranslationOptions';
import { getGT } from './getGT';
import { MFunctionType } from '../types/functions';
import { ResolvableMessages } from '../types/message';
import { msg } from '../msg/msg';

/**
 * Returns the m function that resolves a registered message to its translation.
 * @returns A promise of the m function
 * @important Must be used inside of a request context
 *
 * @example
 * // Registration
 * const registeredMessage = msg('Hello, world!');
 *
 * // Resolution
 * const m = await getMessages();
 * const greeting = m(registeredMessage);
 */
export async function getMessages(): Promise<MFunctionType> {
  // Get the gt function
  const gt = await getGT();

  /**
   * Resolves a registered message to its translation.
   * @param {string | string[] | null | undefined} message - The encoded message to decode and interpolate.
   * @param {InlineTranslationOptions} options - The options to interpolate.
   * @returns - The decoded and interpolated message.
   *
   * @example
   * // Simple message without interpolation
   * const m = await getMessages();
   * const greeting = m(msg('Hello, world!'));
   *
   * @example
   * // Message with interpolation
   * const m = await getMessages();
   * const welcome = m(msg('Welcome, {user}!'), { user: 'Alice' });
   */
  function m<T extends ResolvableMessages>(
    message: T,
    options?: InlineResolveOptions
  ): T extends string ? string : T extends string[] ? string[] : T;
  function m(
    message: ResolvableMessages,
    options: InlineResolveOptions = {}
  ): ResolvableMessages {
    // Handle array
    if (message != null && typeof message !== 'string') {
      return message.map((msg, i) =>
        m(msg, {
          ...options,
          ...(options.id != null && { $id: `${options.id}.${i}` }),
        })
      );
    }

    // Return if the encoded message is null or undefined
    if (message == null) return message;

    // Get any encoded options
    const decodedOptions = decodeOptions(message) ?? {};

    // Return early if string already interpolated eg: mFallback(msg('Hello, {name}!', { name: 'Brian' }))
    if (isEncodedTranslationOptions(decodedOptions)) {
      return gt(decodedOptions.$_source, decodedOptions);
    }

    // Use gt to interpolate
    // Separate from decoded options to match behavior in @gt/react-core
    return gt(message, options);
  }

  return m as MFunctionType;
}
