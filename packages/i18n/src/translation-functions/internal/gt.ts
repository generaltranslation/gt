import { gtFallback } from '../fallbacks/gtFallback';
import { InlineTranslationOptions } from '../types';
import { InteralGtFunctionType } from './types';
import { I18nManager } from '../../i18n-manager/I18nManager';

/**
 * Factory for the gt function.
 * @param i18nManager - The i18n manager to use.
 * @returns The gt function.
 */
export function createGtFunction(i18nManager: I18nManager) {
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
  const gt: InteralGtFunctionType = async (
    message: string,
    options: InlineTranslationOptions
  ) => {
    const translation = await i18nManager.getTranslation(message, options);
    if (translation) message = translation;
    return gtFallback(message, options);
  };

  return gt;
}
