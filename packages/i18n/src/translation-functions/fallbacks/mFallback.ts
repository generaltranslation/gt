import { decodeMsg } from '../msg/decodeMsg';
import { InlineResolveOptions } from '../types/options';
import { decodeOptions } from '../msg/decodeOptions';
import { isEncodedTranslationOptions } from '../utils/isEncodedTranslationOptions';
import { gtFallback } from './gtFallback';
import { ResolvableMessages } from '../types/message';

/**
 * A fallback function for the m() function that decodes and interpolates.
 * @param {string | null | undefined} encodedMsg - The encoded message to decode and interpolate.
 * @param {InlineTranslationOptions} options - The options to interpolate.
 * @returns - The decoded and interpolated message.
 *
 * @note This function is useful as a placeholder when for incrementally migrating to the m() function.
 * @example
 * // A backwards compatible translation function
 * function getMessage(m: MFunctionType = mFallback) {
 *   return m(msg('Hello, world!'));
 * }
 *
 * // Here i18n has been implemented
 * function WithTranslation() {
 *   const m = useMessages();
 *   return <>{getMessage(m)}</>;
 * }
 *
 *
 * // i18n has not yet been implemented yet
 * function WithoutTranslations() {
 *   return <>{getMessage()}</>;
 * }
 */
export function mFallback<T extends ResolvableMessages>(
  message: T
): T extends string ? string : T extends string[] ? string[] : T;
export function mFallback<T extends ResolvableMessages>(
  message: T,
  options?: InlineResolveOptions
): T extends string ? string : T extends string[] ? string[] : T;
export function mFallback(
  message: ResolvableMessages,
  options: InlineResolveOptions = {}
): ResolvableMessages {
  // Handle array
  if (message != null && typeof message !== 'string') {
    return message.map((m, i) =>
      mFallback(m, {
        ...options,
        ...(options.id != null && { $id: `${options.id}.${i}` }),
      })
    );
  }

  // Return if the encoded message is null or undefined
  if (!message) return message;

  // Get any encoded options
  const decodedOptions = decodeOptions(message) ?? {};

  // Return early if string already interpolated eg: mFallback(msg('Hello, {name}!', { name: 'Brian' }))
  if (isEncodedTranslationOptions(decodedOptions)) {
    // This is an encoded string, msg already interpolated, just return decoded string
    return decodeMsg(message);
  }

  // Use gtFallback to interpolate
  // Not using decoded options to match behavior in @gt/react-core
  return gtFallback(message, options);
}
