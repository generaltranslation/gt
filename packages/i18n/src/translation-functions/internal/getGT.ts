import { gtFallback } from '../fallbacks/gtFallback';
import { getI18nManager } from '../../i18n-manager/singleton-operations';
import { InlineTranslationOptions } from '../types/options';
import { GTFunctionType } from '../types/functions';

/**
 * Returns the gt function that registers a string at build time and resolves its translation at runtime.
 * @returns The gt function
 * @important Must be used inside of a request context
 *
 * @example
 * const gt = await getGT();
 * const greeting = gt('Hello, world!');
 */
export async function getGT() {
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
   * const greeting = await gt('Hello, world!');
   *
   * @example
   * // Translation with interpolation
   * const welcome = await gt('Hello, {name}!', { name: 'Alice' });
   */
  const gt: GTFunctionType = (
    message: string,
    options?: InlineTranslationOptions
  ) => {
    const translation = resolveTranslation(message, options);
    if (translation) message = translation;
    return gtFallback(message, options);
  };

  return gt;
}
