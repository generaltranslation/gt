import { getI18nManager } from '../../i18n-manager/singleton-operations';
import { InlineTranslationOptions, LookupOptions } from '../types/options';
import { GTFunctionType } from '../types/functions';
import { interpolateMessage } from '../utils/interpolation/interpolateMessage';

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
  const lookupTranslation = await i18nManager.getLookupTranslation();

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
    const resolutionOptions: LookupOptions = {
      $format: 'ICU',
      ...options,
    };

    // Lookup translation
    const translation = lookupTranslation(message, resolutionOptions);

    // Format result
    return interpolateMessage({
      source: message,
      target: translation,
      options: resolutionOptions,
    });
  };

  return gt;
}
