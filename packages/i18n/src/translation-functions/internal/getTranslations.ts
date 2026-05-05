import {
  getCurrentLocale,
  getI18nManager,
} from '../../i18n-manager/singleton-operations';
import { DictionaryTranslationOptions } from '../types/options';
import { TFunctionType } from '../types/functions';
import { interpolateMessage } from '../utils/interpolation/interpolateMessage';
import { createLookupOptions } from './helpers';
import { extractVariables } from '../../utils/extractVariables';
import type { StringFormat } from 'generaltranslation/types';

/**
 * Returns the t function that translates a dictionary entry based on its id and options.
 * @returns A promise of the t function
 * @important Must be used inside of a request context
 *
 * @example
 * const t = await getTranslations();
 * const title = await t('page.title');
 */
export async function getTranslations(): Promise<TFunctionType> {
  const i18nManager = getI18nManager();
  const locale = getCurrentLocale();
  await i18nManager.loadDictionary(locale);
  const sourceLocale = i18nManager.getDefaultLocale();

  /**
   * Dictionary resolution
   * @param {string} id - The id of the translation to translate.
   * @param {DictionaryTranslationOptions} options - The options for the translation.
   * @returns {string} The translated message.
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
    options: DictionaryTranslationOptions = {}
  ): string => {
    const interpolationOptions = extractVariables(options);
    // Dictionary strings are assumed to be ICU-formatted until dictionary
    // entries can declare their own format.
    const lookupOptions = createLookupOptions<StringFormat>(
      locale,
      interpolationOptions,
      'ICU'
    );

    const sourceEntry = i18nManager.lookupDictionary(sourceLocale, id);
    if (sourceEntry === undefined) {
      return '';
    }
    const targetEntry = i18nManager.lookupDictionary(lookupOptions.$locale, id);

    return interpolateMessage({
      source: sourceEntry,
      target: targetEntry,
      options: lookupOptions,
      sourceLocale,
    });
  };

  return t;
}
