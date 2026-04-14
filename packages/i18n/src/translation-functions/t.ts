import { resolveStringContentWithFallback } from './internal/helpers';
import { SyncResolutionFunctionWithFallback } from './types/functions';

/**
 * Translate a message
 * @param {string} message - The message to translate.
 * @param {InlineTranslationOptions} options - The options for the translation.
 * @returns The translated message.
 */
export const t: SyncResolutionFunctionWithFallback = (message, options) => {
  return resolveStringContentWithFallback(message, {
    $format: 'ICU',
    ...options,
  });
};
