/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { DictionaryTranslationOptions } from '../types';
import { InteralTFunctionType } from './types';
import { I18nManager } from '../../i18n-manager/I18nManager';

/**
 * Factory for the t function.
 * @param i18nManager - The i18n manager to use.
 * @returns The t function.
 */
export function createTFunction(i18nManager: I18nManager) {
  /**
   * Dictionary resolution
   * @param {string} id - The id of the translation to translate.
   * @param {DictionaryTranslationOptions} options - The options for the translation.
   * @returns {string} The translated message.
   *
   * This is a placeholder for the t() function.
   * TODO: Implement the t() function.
   *
   * @example
   * // Simple dictionary lookup without interpolation
   * const title = await t('page.title');
   *
   * @example
   * // Dictionary lookup with interpolation
   * const message = await t('user.greeting', { name: 'Bob' });
   */
  const t: InteralTFunctionType = async (
    id: string,
    options: DictionaryTranslationOptions
  ): Promise<string> => {
    throw new Error('t() is not implemented');
  };
}
