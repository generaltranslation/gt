import { getI18nManager } from '../../i18n-manager/singleton-operations';
import { InlineTranslationOptions } from '../types/options';
import { GTFunctionType } from '../types/functions';
import { interpolateMessage } from '../utils/interpolateMessage';

/**
 * Returns the gt function that registers a string at build time and resolves its translation at runtime.
 * @returns A promise of the gt function
 * @important Must be used inside of a request context
 *
 * @example
 * const gt = await getGT();
 * const greeting = gt('Hello, world!');
 */
export async function getGT(): Promise<GTFunctionType> {
  // Get the translation resolver
  const i18nManager = getI18nManager();
  const resolveTranslation = await i18nManager.getTranslationResolver();

  /**
   * Registers a message at build time and resolves its translation at runtime.
   * @param {string} message - The message to translate
   * @param {InlineTranslationOptions} options - The options for the translation
   * @returns The translated message
   *
   * @example
   * // Simple translation without interpolation
   * const gt = await getGT();
   * const greeting = gt('Hello, world!');
   *
   * @example
   * // Translation with interpolation
   * const gt = await getGT();
   * const welcome = gt('Hello, {name}!', { name: 'Alice' });
   */
  const gt: GTFunctionType = (
    message: string,
    options: InlineTranslationOptions = {}
  ) => {
    const translation = resolveTranslation(message, {
      $format: 'ICU',
      ...options,
    });
    if (translation) {
      return interpolateMessage(translation, {
        ...options,
        $_locales: i18nManager.getLocale(),
        $_fallback: message,
      });
    }
    return interpolateMessage(message, {
      ...options,
      $_locales: i18nManager.getDefaultLocale(),
      $_fallback: message,
    });
  };

  return gt;
}
