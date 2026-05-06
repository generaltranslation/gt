import {
  getCurrentLocale,
  getI18nManager,
} from '../../i18n-manager/singleton-operations';
import {
  DictionaryTranslationOptions,
  BaseTranslationOptions,
} from '../types/options';
import { TFunctionType } from '../types/functions';
import { interpolateMessage } from '../utils/interpolation/interpolateMessage';
import { createLookupOptions } from './helpers';
import { extractVariables } from '../../utils/extractVariables';
import type { StringFormat } from 'generaltranslation/types';
import type {
  Dictionary,
  DictionaryEntry,
  DictionaryObject,
} from '../../i18n-manager/translations-manager/DictionaryCache';
import {
  getDictionaryObject,
  isDictionaryEntry,
  isDictionaryValue,
  resolveDictionaryLookupOptions,
} from '../../i18n-manager/translations-manager/utils/dictionary-helpers';
import type { DictionaryObjectTranslation } from '../types/functions';

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

  const renderEntry = (
    sourceEntry: DictionaryEntry,
    targetEntry: DictionaryEntry | undefined,
    options: DictionaryTranslationOptions = {}
  ): string => {
    const targetLocale =
      typeof options.$locale === 'string' ? options.$locale : locale;
    const dictionaryOptions = resolveDictionaryLookupOptions(
      sourceEntry.options
    );
    const interpolationOptions = extractVariables(options);
    const lookupOptions = createLookupOptions<StringFormat>(
      targetLocale,
      {
        ...dictionaryOptions,
        ...interpolationOptions,
      },
      dictionaryOptions.$format ?? 'ICU'
    );

    return interpolateMessage({
      source: sourceEntry.entry,
      target: targetEntry?.entry,
      options: lookupOptions,
      sourceLocale,
    });
  };

  const renderObject = (
    sourceObject: DictionaryObject,
    targetObject: DictionaryObject | undefined,
    options: DictionaryTranslationOptions = {}
  ): DictionaryObjectTranslation | undefined => {
    if (isDictionaryEntry(sourceObject)) {
      return renderEntry(
        sourceObject,
        isDictionaryEntry(targetObject) ? targetObject : undefined,
        options
      );
    }

    const result: Record<string, DictionaryObjectTranslation> = {};
    for (const [key, value] of Object.entries(sourceObject)) {
      const sourceChild = getDictionaryObject(value);
      if (sourceChild === undefined) {
        continue;
      }
      const targetChild = isDictionaryValue(targetObject)
        ? getDictionaryObject(targetObject[key])
        : undefined;
      const renderedChild = renderObject(sourceChild, targetChild, options);
      if (renderedChild !== undefined) {
        result[key] = renderedChild;
      }
    }
    return result;
  };

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
    const targetLocale =
      typeof options.$locale === 'string' ? options.$locale : locale;
    const sourceEntry = i18nManager.lookupDictionary(sourceLocale, id);
    if (sourceEntry === undefined) {
      return '';
    }
    const targetEntry = i18nManager.lookupDictionary(targetLocale, id);
    return renderEntry(sourceEntry, targetEntry, options);
  }) as TFunctionType;

  t.obj = (
    id: string,
    options: BaseTranslationOptions = {}
  ): DictionaryObjectTranslation | undefined => {
    const targetLocale =
      typeof options.$locale === 'string' ? options.$locale : locale;
    const sourceObject = i18nManager.lookupDictionaryObj(sourceLocale, id);
    if (sourceObject === undefined) {
      return undefined;
    }
    const targetObject = i18nManager.lookupDictionaryObj(targetLocale, id);
    return renderObject(sourceObject, targetObject, options);
  };

  return t;
}
