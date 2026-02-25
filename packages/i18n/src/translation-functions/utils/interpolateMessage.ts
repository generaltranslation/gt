import { extractVariables } from '../../utils/extractVariables';
import { formatMessage } from './formatMessage';
import { VAR_IDENTIFIER } from 'generaltranslation/internal';
import { formatCutoff } from 'generaltranslation';
import logger from '../../logs/logger';
import { interpolationFailureMessage } from './messages';
import type { InlineTranslationOptions } from '../types/options';
import type { InterpolatableMessage } from '../types/message';

/**
 * Applies string interpolation and cutoff formatting. Fallsback to the original message if interpolation fails.
 * @param {string | null | undefined} message - The message to interpolate see for more details.
 * @param {InlineTranslationOptions} options - The options to interpolate.
 * @returns {string | string[]} - The interpolated message(s).
 *
 * TODO: investigate indexVars(), condenseVars(), and extractVars() from core (see useCreateInternalUseGTFunction.ts) for example
 * we need to properly handle interpolation for declareVar()
 */
export function interpolateMessage(
  message: string,
  options: InlineTranslationOptions
): string;
export function interpolateMessage<T extends null | undefined>(
  message: T,
  options: InlineTranslationOptions
): T;
export function interpolateMessage(
  message: InterpolatableMessage,
  options: InlineTranslationOptions
): InterpolatableMessage {
  // Return if the encoded message is null or undefined
  if (!message) return message;

  // Remove any gt related options
  const variables = extractVariables(options);

  try {
    // Interpolate the message
    const interpolatedMessage = formatMessage(message, {
      ...variables,
      [VAR_IDENTIFIER]: 'other',
    });
    // Apply cutoff formatting
    const cutoffMessage = formatCutoff(interpolatedMessage, {
      maxChars: options.$maxChars,
    });
    return cutoffMessage;
  } catch {
    // Fallback to decodeMsg
    logger.warn(interpolationFailureMessage);
    return message;
  }
}
