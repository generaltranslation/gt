import { decodeMsg } from '../msg/decodeMsg';
import { InlineResolveOptions, MFunctionType } from '../types';
import { decodeOptions } from '../msg/decodeOptions';
import { isEncodedTranslationOptions } from '../utils/isEncodedTranslationOptions';
import { gtFallback } from './gtFallback';

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
export const mFallback: MFunctionType = <T extends string | null | undefined>(
  encodedMsg: T,
  options: InlineResolveOptions = {}
): T extends string ? string : T => {
  // Return if the encoded message is null or undefined
  if (!encodedMsg) return encodedMsg as T extends string ? string : T;

  // Get any encoded options
  const decodedOptions = decodeOptions(encodedMsg) ?? {};

  // Return early if string already interpolated eg: mFallback(msg('Hello, {name}!', { name: 'Brian' }))
  if (isEncodedTranslationOptions(decodedOptions)) {
    // This is an encoded string, msg already interpolated, just return decoded string
    return decodeMsg(encodedMsg) as T extends string ? string : T;
  }

  // Use gtFallback to interpolate
  // Not using decoded options to match behavior in @gt/react-core
  return gtFallback(encodedMsg, options) as T extends string ? string : T;
};
