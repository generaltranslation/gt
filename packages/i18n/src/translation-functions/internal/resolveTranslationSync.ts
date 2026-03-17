import { getI18nManager } from '../../i18n-manager/singleton-operations';
import { SyncResolutionFunction } from '../types/functions';
import { gtFallback } from '../fallbacks/gtFallback';

/**
 * Synchronously resolve a translation for a given message and options
 * @param {string} message - The message to translate.
 * @param {InlineTranslationOptions} [options] - The options for the translation.
 * @returns {string} The translated message.
 */
export const resolveTranslationSync: SyncResolutionFunction = (
  message,
  options
) => {
  const i18nManager = getI18nManager();
  const translation = i18nManager.resolveTranslationSync(message, options);
  if (translation) {
    return gtFallback(translation, { ...options, $_fallback: message });
  }
  return gtFallback(message, options);
};
