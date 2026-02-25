import { InlineTranslationOptions } from '../types/options';
import { interpolateMessage } from '../utils/interpolateMessage';
import { RegisterableMessages } from '../types/message';

/**
 * A fallback function for the gt() function that decodes and interpolates.
 * @param {string | string[] | null | undefined} message - The ICU formatted message to interpolate see {@link InterpolatableMessage} for more details.
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
// export function gtFallback(
//   message: string,
//   options?: InlineTranslationOptions
// ): string;
// export function gtFallback(
//   message: string[] | readonly string[],
//   options?: InlineTranslationOptions
// ): string[];
export function gtFallback<T extends RegisterableMessages>(
  message: T
): T extends string ? string : string[];
export function gtFallback<T extends RegisterableMessages>(
  message: T,
  options?: InlineTranslationOptions
): T extends string ? string : string[];
export function gtFallback(
  message: RegisterableMessages,
  options?: InlineTranslationOptions
): RegisterableMessages {
  return typeof message !== 'string'
    ? message.map((m, i) =>
        interpolateMessage(m, {
          ...options,
          ...(options?.id != null && { $id: `${options.id}.${i}` }),
        })
      )
    : interpolateMessage(message, options ?? {});
}

const a: typeof gtFallback = (
  message1: string,
  options?: InlineTranslationOptions
) => message1;
