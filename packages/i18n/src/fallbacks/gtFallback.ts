import { GTFunctionType, InlineTranslationOptions } from '../types';
import logger from '../logs/logger';
import { formatMessage } from './utils/formatMessage';
import { extractVariables } from '../utils/extractVariables';
import { interpolationFailureWarning } from '../logs/warnings';
import { formatCutoff } from 'generaltranslation';

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
  encodedMsg: T,
  options: InlineTranslationOptions = {}
): T extends string ? string : T => {
  // Return if the encoded message is null or undefined
  if (!encodedMsg) return encodedMsg as T extends string ? string : T;

  // Remove any gt related options
  const variables = extractVariables(options);

  // No decoded options, fallback to decodeMsg
  if (Object.keys(variables).length === 0) {
    return encodedMsg as T extends string ? string : T;
  }

  try {
    // Interpolate the message
    const interpolatedMessage = formatMessage(encodedMsg, variables);
    // Apply cutoff formatting
    const cutoffMessage = formatCutoff(interpolatedMessage, {
      maxChars: options.$maxChars,
    });
    return cutoffMessage as T extends string ? string : T;
  } catch {
    // Fallback to decodeMsg
    logger.warn(interpolationFailureWarning);
    return encodedMsg as T extends string ? string : T;
  }
};
