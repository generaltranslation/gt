import { InlineResolveOptions } from '../types';
import { decodeOptions } from '../msg/decodeOptions';
import { isEncodedTranslationOptions } from '../utils/isEncodedTranslationOptions';
import { gt } from './gt';
import { InteralMFunctionType } from './types';

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
export const m: InteralMFunctionType = async (
  encodedMsg: string,
  options?: InlineResolveOptions
): Promise<string> => {
  // Get any encoded options
  const decodedOptions = decodeOptions(encodedMsg) ?? {};

  // Return early if string already interpolated eg: mFallback(msg('Hello, {name}!', { name: 'Brian' }))
  if (isEncodedTranslationOptions(decodedOptions)) {
    return gt(decodedOptions.$_source, decodedOptions);
  }

  // Use gt to interpolate
  // Separate from decoded options to match behavior in @gt/react-core
  return gt(encodedMsg, options);
};

/**
 * Resolves a registered message to its translation.
 * @param {string | null | undefined} encodedMsg - The encoded message to decode and interpolate.
 * @param {InlineTranslationOptions} options - The options to interpolate.
 * @returns - The decoded and interpolated message.
 *
 * @example
 * // Simple message without interpolation
 * const greeting = await res(reg('Hello, world!'));
 *
 * @example
 * // Message with interpolation
 * const welcome = await res(reg('Welcome, {user}!'), { user: 'Alice' });
 *
 */
export const res = m;
