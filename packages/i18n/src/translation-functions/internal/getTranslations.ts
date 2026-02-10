/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { DictionaryTranslationOptions } from '../types/options';
import { TFunctionType } from '../types/functions';

/**
 * Returns the t function that translates a dictionary entry based on its id and options.
 * @returns The t function
 * @important Must be used inside of a request context
 *
 * @deprecated not yet supported
 *
 * @example
 * const t = await getTranslations();
 * const title = await t('page.title');
 */
export async function getTranslations() {
  /**
   * Dictionary resolution
   * @param {string} id - The id of the translation to translate.
   * @param {DictionaryTranslationOptions} options - The options for the translation.
   * @returns {string} The translated message.
   *
   * @deprecated not yet supported
   *
   * This is a placeholder for the t() function.
   * TODO: Implement the t() function.
   *
   * @example
   * // Simple dictionary lookup without interpolation
   * const t = await getTranslations();
   * const title = t('page.title');
   *
   * @example
   * // Dictionary lookup with interpolation
   * const t = await getTranslations();
   * const greeting = t('user.greeting', { name: 'Bob' });
   */
  const t: TFunctionType = (
    id: string,
    options?: DictionaryTranslationOptions
  ): string => {
    throw new Error('t() is not implemented');
  };

  return t;
}
