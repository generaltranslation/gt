import { InlineTranslationOptions } from '../types/options';
import { GTFunctionType } from '../types/functions';
import { interpolateMessage } from '../utils/interpolateMessage';

/**
 * A fallback function for the gt() function that decodes and interpolates.
 * @param {string | null | undefined} message - The ICU formatted message to interpolate.
 * @param {InlineTranslationOptions} options - The options to interpolate.
 * @returns - The decoded and interpolated message.
 *
 * @note This function is useful as a placeholder when for incrementally migrating to the m() function.
 * @example
 * // A backwards compatible translation function
 * function getMessage(gt: GTFunctionType = gtFallback) {
 *   return gt('Hello, world!');
 * }
 *
 * // Here i18n has been implemented
 * function WithTranslation() {
 *   const gt = useGT();
 *   return <>{getMessage(gt)}</>;
 * }
 *
 *
 * // i18n has not yet been implemented yet
 * function WithoutTranslations() {
 *   return <>{getMessage()}</>;
 * }
 */
export const gtFallback: GTFunctionType = <T extends string | null | undefined>(
  message: T,
  options: InlineTranslationOptions = {}
): T extends string ? string : T => {
  return interpolateMessage(message, options);
};
