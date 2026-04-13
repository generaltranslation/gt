import { getI18nManager } from '../../i18n-manager/singleton-operations';
import { LookupOptions } from '../types/options';
import {
  SyncResolutionFunction,
  SyncResolutionFunctionWithFallback,
} from '../types/functions';
import { interpolateMessage } from '../utils/interpolation/interpolateMessage';
import { resolveTranslation } from './resolveTranslation';

/**
 * Synchronously resolve a translation for a given message and options
 * @param {string} message - The message to translate.
 * @param {InlineTranslationOptions} [options] - The options for the translation.
 * @returns {string | undefined} The translated message or undefined if the message is not found.
 * @deprecated use resolveTranslation instead
 */
export const resolveTranslationSync: SyncResolutionFunction = (
  message,
  options
) => {
  return resolveTranslation(message, { $format: 'ICU', ...options });
};

/**
 * Translate a message
 * @param {string} message - The message to translate.
 * @param {InlineTranslationOptions} [options] - The options for the translation.
 * @returns {string} The translated message or the original message interpolated if the translation is not found.
 * @deprecated use resolveTranslationWithFallback instead
 */
export const resolveTranslationSyncWithFallback: SyncResolutionFunctionWithFallback =
  (message, options = {}) => {
    const resolutionOptions: LookupOptions = {
      $format: 'ICU',
      ...options,
    };
    const i18nManager = getI18nManager();
    const translation = i18nManager.lookupTranslation(
      message,
      resolutionOptions
    );
    return interpolateMessage({
      source: message,
      target: translation,
      options: resolutionOptions,
    });
  };
