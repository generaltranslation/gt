import { extractVariables } from '../../../utils/extractVariables';
import { formatMessage } from '../formatMessage';
import {
  VAR_IDENTIFIER,
  extractVars,
  condenseVars,
} from 'generaltranslation/internal';
import { formatCutoff } from 'generaltranslation';
import logger from '../../../logs/logger';
import { createInterpolationFailureMessage } from '../messages';
import type { InlineTranslationOptions } from '../../types/options';

/**
 * Applies string interpolation and cutoff formatting. Fallsback to the original message if interpolation fails.
 * @param {string} message - The message to interpolate.
 * @param {InlineTranslationOptions} options - The options to interpolate.
 * @returns {string} - The interpolated message.
 */
export function interpolateIcuMessage<T extends string | null | undefined>(
  encodedMsg: T,
  options: InlineTranslationOptions
): T extends string ? string : T {
  // Return if the encoded message is null or undefined
  if (!encodedMsg) return encodedMsg as T extends string ? string : T;

  // Get the source to use as a fallback
  const source = options.$_fallback;

  // Remove any gt related options
  const variables = extractVariables(options);

  try {
    // Extract declared variable values from the source/fallback
    const declaredVars = extractVars(source || '');

    // Condense indexed selects to arguments if declared vars exist
    const message = Object.keys(declaredVars).length
      ? condenseVars(encodedMsg)
      : encodedMsg;

    // Interpolate the message
    // TODO: do we need to call indexVars here??
    const interpolatedMessage = formatMessage(
      message,
      {
        ...variables,
        ...declaredVars,
        [VAR_IDENTIFIER]: 'other',
      },
      options.$locale ?? options.$_locales,
      options.$format
    );
    // Apply cutoff formatting
    const cutoffMessage = formatCutoff(interpolatedMessage, {
      maxChars: options.$maxChars,
    });
    return cutoffMessage as T extends string ? string : T;
  } catch {
    logger.warn(createInterpolationFailureMessage(encodedMsg));

    // If formatting the translation failed and we have a fallback, try formatting the source instead
    if (options.$_fallback != null) {
      return interpolateIcuMessage(options.$_fallback, {
        ...options,
        $_fallback: undefined,
      }) as T extends string ? string : T;
    }

    // Apply cutoff formatting
    const cutoffMessage = formatCutoff(encodedMsg, {
      maxChars: options.$maxChars,
    });
    return cutoffMessage as T extends string ? string : T;
  }
}
