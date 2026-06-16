import { InlineTranslationOptions } from '../types/options';
import {
  resolveStringContent,
  resolveStringContentWithFallback,
} from './helpers';
import { getDefaultStringFormat } from '@generaltranslation/format/internal';

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
  return resolveStringContent(locale, message, {
    ...options,
    $format: options.$format ?? getDefaultStringFormat(),
  });
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
    ...options,
    $format: options.$format ?? getDefaultStringFormat(),
  });
}
