import { RuntimeTranslationOptions } from '../types/options';
import { TxFunctionType } from '../types/functions';
import { getI18nManager } from '../../i18n-manager/singleton-operations';
import { interpolateMessage } from '../utils/interpolation/interpolateMessage';

/**
 * Translates a message at runtime.
 * @param {string} message - The message to translate.
 * @param {RuntimeTranslationOptions} options - The options for the translation.
 * @returns {Promise<string>} The translated message.
 *
 * @example
 * // Simple runtime translation without interpolation
 * const status = await tx('Processing complete');
 *
 * @example
 * // Runtime translation with interpolation
 * const progress = await tx(`Processing ${status}`, { locale: 'es-MX' });
 */

export const tx: TxFunctionType = async (
  message: string,
  options: RuntimeTranslationOptions = {}
): Promise<string> => {
  const $format = options.$format ?? 'STRING';
  const i18nManager = getI18nManager();
  const translation = await i18nManager.lookupTranslationWithFallback(message, {
    $format,
    ...options,
  });
  if (translation) {
    return interpolateMessage(translation, {
      ...options,
      $format,
      $locale: i18nManager.getLocale(),
      $_fallback: message,
    });
  }
  return interpolateMessage(message, {
    ...options,
    $format,
    $locale: i18nManager.getDefaultLocale(),
    $_fallback: message,
  });
};
