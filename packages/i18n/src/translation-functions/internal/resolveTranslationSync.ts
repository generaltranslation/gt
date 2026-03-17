import { getI18nManager } from '../../i18n-manager/singleton-operations';
import { SyncResolutionFunction } from '../types/functions';
import { interpolateMessage } from '../utils/interpolateMessage';

/**
 * Synchronously resolve a translation for a given message and options
 * @param {string} message - The message to translate.
 * @param {InlineTranslationOptions} [options] - The options for the translation.
 * @returns {string} The translated message.
 */
export const resolveTranslationSync: SyncResolutionFunction = (
  message,
  options = {}
) => {
  const i18nManager = getI18nManager();
  const translation = i18nManager.resolveTranslationSync(message, options);
  if (translation) {
    return interpolateMessage(translation, { ...options, $_fallback: message });
  }
  return interpolateMessage(message, options);
};
