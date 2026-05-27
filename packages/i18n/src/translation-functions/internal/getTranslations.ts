import { getI18nCache } from '../../i18n-cache/singleton-operations';
import { getI18nConfig } from '../../i18n-config/singleton-operations';
import { DictionaryTranslationOptions } from '../types/options';
import { TFunctionType } from '../types/functions';
import { renderDictionaryEntry } from './renderDictionaryEntry';
import { renderDictionaryObject } from './renderDictionaryObject';
import { resolveDictionaryLookupOptions } from '../../i18n-cache/translations-manager/utils/dictionary-helpers';
import type { DictionaryObjectTranslation } from '../types/functions';
import { getLocale } from '../../helpers/locale';

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
  const i18nCache = getI18nCache();
  const locale = getLocale();
  await Promise.all([
    i18nCache.loadDictionary(locale),
    i18nCache.loadTranslations(locale),
  ]);
  const sourceLocale = getI18nConfig().getDefaultLocale();

  /**
   * Dictionary resolution
   * @param {string} id - The id of the translation to translate.
   * @param {DictionaryTranslationOptions} options - The options for interpolation.
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
  const t = ((
    id: string,
    options: DictionaryTranslationOptions = {}
  ): string => {
    const sourceEntry = i18nCache.lookupDictionary(sourceLocale, id);
    if (sourceEntry === undefined) {
      throw new Error(`Dictionary entry ${id} cannot be found`);
    }
    const targetEntry = i18nCache.lookupDictionary(locale, id);
    const dictionaryOptions = resolveDictionaryLookupOptions(
      sourceEntry.options
    );
    const target =
      targetEntry?.entry ??
      i18nCache.lookupTranslation(locale, sourceEntry.entry, dictionaryOptions);
    return renderDictionaryEntry({
      sourceLocale,
      targetLocale: locale,
      sourceEntry,
      target,
      dictionaryOptions,
      options,
    });
  }) as TFunctionType;

  /**
   * Returns a subtree of the dictionary object translation based on its id.
   * @param {string} id - The id of the translation to translate.
   * @returns The translated object.
   *
   * @example
   * const t = await getTranslations();
   * const greetings = t.obj('greetings');
   * console.log(greetings);
   * // { greeting1: 'Hello', greeting2: 'Hi' }
   */
  t.obj = (id: string): DictionaryObjectTranslation => {
    const sourceObject = i18nCache.lookupDictionaryObj(sourceLocale, id);
    if (sourceObject === undefined) {
      throw new Error(`Dictionary entry ${id} cannot be found`);
    }
    const targetObject = i18nCache.lookupDictionaryObj(locale, id);
    return renderDictionaryObject({
      sourceObject,
      targetObject,
      translate: (sourceEntry, dictionaryOptions) =>
        i18nCache.lookupTranslation(
          locale,
          sourceEntry.entry,
          dictionaryOptions
        ),
    });
  };

  return t;
}
