import { InlineTranslationOptions } from '../types/options';
import {
  resolveStringContent,
  resolveStringContentWithFallback,
} from './helpers';

/**
 * Synchronously resolve a translation for a given message and options
 * @param {string} message - The message to translate.
 * @param {InlineTranslationOptions} [options] - The options for the translation.
 * @returns {string | undefined} The translated message or undefined if the message is not found.
 * @deprecated use resolveTranslation instead
 */
export function resolveTranslationSync(
  locale: string,
  message: string,
  options: InlineTranslationOptions = {}
) {
  return resolveStringContent(locale, message, { $format: 'ICU', ...options });
}

/**
 * Translate a message
 * @param {string} message - The message to translate.
 * @param {InlineTranslationOptions} [options] - The options for the translation.
 * @returns {string} The translated message or the original message interpolated if the translation is not found.
 * @deprecated use resolveTranslationWithFallback instead
 */
export function resolveTranslationSyncWithFallback(
  locale: string,
  message: string,
  options: InlineTranslationOptions = {}
) {
  return resolveStringContentWithFallback(locale, message, {
    $format: 'ICU',
    ...options,
  });
}
