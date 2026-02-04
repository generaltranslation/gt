import { decodeMsg } from '../msg/decodeMsg';
import {
  InlineResolveOptions,
  InlineTranslationOptions,
  MFunctionType,
} from '../../types';
import { decodeOptions } from '../msg/decodeOptions';
import { isEncodedTranslationOptions } from '../fallbacks/utils/isEncodedTranslationOptions';
import { gt } from '../gt/gt';

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
 *
 * TODO: comment and types
 */
export async function m(
  encodedMsg: string,
  options: InlineResolveOptions = {}
): Promise<string> {
  // Get any encoded options
  const decodedOptions: InlineTranslationOptions =
    decodeOptions(encodedMsg) ?? {};

  // Return early if string already interpolated eg: mFallback(msg('Hello, {name}!', { name: 'Brian' }))
  if (isEncodedTranslationOptions(decodedOptions)) {
    return gt(decodedOptions.$_source, decodedOptions);
  }

  // Use gt to interpolate
  return gt(encodedMsg, options);
}
