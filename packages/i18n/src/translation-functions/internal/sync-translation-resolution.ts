import { getI18nManager } from '../../i18n-manager/singleton-operations';
import {
  SyncResolutionFunction,
  SyncResolutionFunctionWithFallback,
} from '../types/functions';
import { interpolateIcuMessage } from '../utils/interpolation/interpolateIcuMessage';

/**
 * Synchronously resolve a translation for a given message and options
 * @param {string} message - The message to translate.
 * @param {InlineTranslationOptions} [options] - The options for the translation.
 * @returns {string | undefined} The translated message or undefined if the message is not found.
 */
export const resolveTranslationSync: SyncResolutionFunction = (
  message,
  options = {}
) => {
  const i18nManager = getI18nManager();
  const translation = i18nManager.lookupTranslation<string>(message, {
    $format: 'ICU',
    ...options,
  });
  if (!translation) return undefined;
  return interpolateIcuMessage(translation, {
    $locale: i18nManager.getLocale(),
    ...options,
    $_fallback: message,
  });
};

/**
 * Translate a message
 * @param {string} message - The message to translate.
 * @param {InlineTranslationOptions} [options] - The options for the translation.
 * @returns {string} The translated message or the original message interpolated if the translation is not found.
 */
export const resolveTranslationSyncWithFallback: SyncResolutionFunctionWithFallback =
  (message, options = {}) => {
    const translation = resolveTranslationSync(message, options);
    if (translation) return translation;
    const i18nManager = getI18nManager();
    return interpolateIcuMessage(message, {
      $locale: i18nManager.getDefaultLocale(),
      ...options,
      $_fallback: message,
    });
  };
