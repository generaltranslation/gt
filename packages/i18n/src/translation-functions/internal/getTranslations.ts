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
import type {
  DictionaryEntry,
  DictionaryValue,
} from '../../i18n-manager/translations-manager/DictionaryCache';
import {
  getDictionaryEntry,
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
    const sourceEntry = i18nManager.lookupDictionary(sourceLocale, id);
    if (sourceEntry === undefined) {
      return '';
    }
    const targetEntry = i18nManager.lookupDictionary(locale, id);
    return renderEntry({
      sourceLocale,
      targetLocale: locale,
      sourceEntry,
      targetEntry,
      options,
    });
  }) as TFunctionType;

  t.obj = (id: string): DictionaryObjectTranslation | undefined => {
    const sourceObject = i18nManager.lookupDictionaryObj(sourceLocale, id);
    if (sourceObject === undefined) {
      return undefined;
    }
    const targetObject = i18nManager.lookupDictionaryObj(locale, id);
    return renderObject({ sourceObject, targetObject });
  };

  return t;
}

function renderEntry({
  sourceLocale,
  targetLocale,
  sourceEntry,
  targetEntry,
  options = {},
}: {
  sourceLocale: string;
  targetLocale: string;
  sourceEntry: DictionaryEntry;
  targetEntry: DictionaryEntry | undefined;
  options?: DictionaryTranslationOptions;
}): string {
  const dictionaryOptions = resolveDictionaryLookupOptions(sourceEntry.options);
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
}

function renderObject({
  sourceObject,
  targetObject,
}: {
  sourceObject: DictionaryValue | undefined;
  targetObject: DictionaryValue | undefined;
}): DictionaryObjectTranslation | undefined {
  const targetEntry = getDictionaryEntry(targetObject);
  if (targetEntry !== undefined) {
    return targetEntry.entry;
  }

  if (targetObject !== undefined && !isDictionaryValue(targetObject)) {
    return undefined;
  }

  const sourceEntry = getDictionaryEntry(sourceObject);
  if (sourceObject === undefined) {
    return isDictionaryValue(targetObject)
      ? renderObject({ sourceObject: targetObject, targetObject: undefined })
      : undefined;
  }

  if (!isDictionaryValue(sourceObject)) {
    if (isDictionaryValue(targetObject)) {
      return renderObject({
        sourceObject: targetObject,
        targetObject: undefined,
      });
    }
    return sourceEntry?.entry;
  }

  const result: Record<string, DictionaryObjectTranslation> = {};
  const keys = new Set([
    ...Object.keys(sourceObject),
    ...(isDictionaryValue(targetObject) ? Object.keys(targetObject) : []),
  ]);

  for (const key of keys) {
    const renderedChild = renderObject({
      sourceObject: sourceObject[key],
      targetObject: isDictionaryValue(targetObject)
        ? targetObject[key]
        : undefined,
    });
    if (renderedChild !== undefined) {
      result[key] = renderedChild;
    }
  }

  return result;
}
