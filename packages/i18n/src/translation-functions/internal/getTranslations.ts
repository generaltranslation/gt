import { getI18nCache } from '../../i18n-cache/singleton-operations';
import { getI18nConfig } from '../../i18n-config/singleton-operations';
import { TranslationVariables } from '../types/options';
import { TFunctionType } from '../types/functions';
import { renderDictionaryEntry } from './renderDictionaryEntry';
import { renderDictionaryObject } from './renderDictionaryObject';
import { resolveDictionaryLookupOptions } from '../../i18n-cache/translations-manager/utils/dictionary-helpers';
import type { DictionaryObjectTranslation } from '../types/functions';
import { getWritableConditionStore } from '../../condition-store/singleton-operations';

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
  const conditionStore = getWritableConditionStore();
  const locale = conditionStore.getLocale();
  const enableI18n = conditionStore.getEnableI18n();
  return getTranslationsInternal({ locale, enableI18n });
}

/**
 * Condition store agnostic getTranslations function
 */
export async function getTranslationsInternal({
  locale,
  enableI18n,
}: {
  locale: string;
  enableI18n: boolean;
}): Promise<TFunctionType> {
  const i18nCache = getI18nCache();
  const sourceLocale = getI18nConfig().getDefaultLocale();
  const targetLocale = enableI18n ? locale : sourceLocale;
  const [
    lookupSourceDictionary,
    lookupTargetDictionary,
    lookupSourceDictionaryObj,
    lookupTargetDictionaryObj,
    lookupTranslation,
  ] = await Promise.all([
    i18nCache.getLookupDictionary(sourceLocale),
    i18nCache.getLookupDictionary(targetLocale),
    i18nCache.getLookupDictionaryObj(sourceLocale),
    i18nCache.getLookupDictionaryObj(targetLocale),
    i18nCache.getLookupTranslation(targetLocale),
  ]);

  /**
   * Dictionary resolution
   * @param {string} id - The id of the translation to translate.
   * @param {TranslationVariables} options - The variables for interpolation.
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
  const t = ((id: string, options: TranslationVariables = {}): string => {
    const sourceEntry = lookupSourceDictionary(id);
    if (sourceEntry === undefined) {
      throw new Error(`Dictionary entry ${id} cannot be found`);
    }
    const targetEntry = lookupTargetDictionary(id);
    const dictionaryOptions = resolveDictionaryLookupOptions(
      sourceEntry.options
    );
    const target =
      targetEntry?.entry ??
      lookupTranslation(sourceEntry.entry, dictionaryOptions);
    return renderDictionaryEntry({
      sourceLocale,
      targetLocale: targetLocale,
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
    const sourceObject = lookupSourceDictionaryObj(id);
    if (sourceObject === undefined) {
      throw new Error(`Dictionary entry ${id} cannot be found`);
    }
    const targetObject = lookupTargetDictionaryObj(id);
    return renderDictionaryObject({
      sourceObject,
      targetObject,
      translate: (sourceEntry, dictionaryOptions) =>
        lookupTranslation(sourceEntry.entry, dictionaryOptions),
    });
  };

  return t;
}
