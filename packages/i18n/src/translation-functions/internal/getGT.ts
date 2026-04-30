import {
  getCurrentLocale,
  getI18nManager,
} from '../../i18n-manager/singleton-operations';
import { InlineTranslationOptions } from '../types/options';
import { GTFunctionType } from '../types/functions';
import { interpolateMessage } from '../utils/interpolation/interpolateMessage';
import { createLookupOptions } from './helpers';
import type { StringFormat } from 'generaltranslation/types';

/**
 * Returns the gt function that registers a string at build time and resolves its translation at runtime.
 * @returns A promise of the gt function
 *
 * @example
 * const gt = await getGT();
 * const greeting = gt('Hello, world!');
 */
export async function getGT(): Promise<GTFunctionType> {
  // Get the translation resolver
  const i18nManager = getI18nManager();
  const locale = getCurrentLocale();
  await i18nManager.loadTranslations(locale);
  const sourceLocale = i18nManager.getDefaultLocale();

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
    const lookupOptions = createLookupOptions<StringFormat>(
      options,
      'ICU',
      locale
    );

    // Lookup translation
    const translation = i18nManager.lookupTranslation(
      lookupOptions.$locale,
      message,
      lookupOptions
    );

    // Format result
    return interpolateMessage({
      source: message,
      target: translation,
      options: lookupOptions,
      sourceLocale,
    });
  };

  return gt;
}
