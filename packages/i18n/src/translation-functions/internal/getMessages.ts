import { InlineResolveOptions } from '../types/options';
import { decodeOptions } from '../msg/decodeOptions';
import { isEncodedTranslationOptions } from '../utils/isEncodedTranslationOptions';
import { getGT } from './getGT';
import { MFunctionType } from '../types/functions';

/**
 * Returns the m function that resolves a registered message to its translation.
 * @returns The m function
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
export async function getMessages() {
  // Get the gt function
  const gt = await getGT();

  /**
   * Resolves a registered message to its translation.
   * @param {string | null | undefined} encodedMsg - The encoded message to decode and interpolate.
   * @param {InlineTranslationOptions} options - The options to interpolate.
   * @returns - The decoded and interpolated message.
   *
   * @example
   * // Simple message without interpolation
   * const greeting = await m(msg('Hello, world!'));
   *
   * @example
   * // Message with interpolation
   * const welcome = await m(msg('Welcome, {user}!'), { user: 'Alice' });
   */
  const m: MFunctionType = <T extends string | null | undefined>(
    encodedMsg: T,
    options: InlineResolveOptions = {}
  ): T extends string ? string : T => {
    // Return if the encoded message is null or undefined
    if (encodedMsg == null) return encodedMsg as T extends string ? string : T;

    // Get any encoded options
    const decodedOptions = decodeOptions(encodedMsg) ?? {};

    // Return early if string already interpolated eg: mFallback(msg('Hello, {name}!', { name: 'Brian' }))
    if (isEncodedTranslationOptions(decodedOptions)) {
      return gt(decodedOptions.$_source, decodedOptions) as T extends string
        ? string
        : T;
    }

    // Use gt to interpolate
    // Separate from decoded options to match behavior in @gt/react-core
    return gt(encodedMsg, options) as T extends string ? string : T;
  };

  return m;
}
