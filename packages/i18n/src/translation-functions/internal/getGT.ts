import { gtFallback } from '../fallbacks/gtFallback';
import { getI18nManager } from '../../i18n-manager/singleton-operations';
import { InlineTranslationOptions } from '../types/options';
import { GTFunctionType } from '../types/functions';
import { RegisterableMessage } from '../types/message';

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
   * @param {string | string[]} message - The message to translate
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
  function gt(message: string, options?: InlineTranslationOptions): string;
  function gt(message: string[], options?: InlineTranslationOptions): string[];
  function gt(
    message: RegisterableMessage,
    options?: InlineTranslationOptions
  ): RegisterableMessage {
    // Handle array
    if (Array.isArray(message)) {
      return message.map((m) => gt(m, options));
    }

    // Resolve translation
    const translation = resolveTranslation(message, options);
    if (translation) message = translation;

    // Interpolate
    return gtFallback(message, options);
  }

  // type check
  return gt as GTFunctionType;
}
