import {
  getCurrentLocale,
  getI18nManager,
} from "../../i18n-manager/singleton-operations";
import { DictionaryTranslationOptions } from "../types/options";
import { TFunctionType } from "../types/functions";
import { renderDictionaryEntry } from "./renderDictionaryEntry";
import { renderDictionaryObject } from "./renderDictionaryObject";
import { resolveDictionaryLookupOptions } from "../../i18n-manager/translations-manager/utils/dictionary-helpers";
import type { DictionaryObjectTranslation } from "../types/functions";

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
  await Promise.all([
    i18nManager.loadDictionary(locale),
    i18nManager.loadTranslations(locale),
  ]);
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
    options: DictionaryTranslationOptions = {},
  ): string => {
    const sourceEntry = i18nManager.lookupDictionary(sourceLocale, id);
    if (sourceEntry === undefined) {
      throw new Error(`Dictionary entry ${id} cannot be found`);
    }
    const targetEntry = i18nManager.lookupDictionary(locale, id);
    const dictionaryOptions = resolveDictionaryLookupOptions(
      sourceEntry.options,
    );
    const target =
      targetEntry?.entry ??
      i18nManager.lookupTranslation(
        locale,
        sourceEntry.entry,
        dictionaryOptions,
      );
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
    const sourceObject = i18nManager.lookupDictionaryObj(sourceLocale, id);
    if (sourceObject === undefined) {
      throw new Error(`Dictionary entry ${id} cannot be found`);
    }
    const targetObject = i18nManager.lookupDictionaryObj(locale, id);
    return renderDictionaryObject({
      sourceObject,
      targetObject,
      translate: (sourceEntry, dictionaryOptions) =>
        i18nManager.lookupTranslation(
          locale,
          sourceEntry.entry,
          dictionaryOptions,
        ),
    });
  };

  // function renderObject({
  //   sourceObject,
  //   targetObject,
  // }: {
  //   sourceObject: DictionaryValue | undefined;
  //   targetObject: DictionaryValue | undefined;
  // }): DictionaryObjectTranslation {
  //   const targetEntry = getDictionaryEntry(targetObject);
  //   if (targetEntry !== undefined) {
  //     return targetEntry.entry;
  //   }

  //   if (isDictionaryObject(targetObject)) {
  //     if (!isDictionaryObject(sourceObject)) {
  //       return renderObject({
  //         sourceObject: targetObject,
  //         targetObject: undefined,
  //       });
  //     }

  //     return renderDictionaryObject({
  //       sourceObject,
  //       targetObject,
  //     });
  //   }

  //   const sourceEntry = getDictionaryEntry(sourceObject);
  //   if (sourceEntry !== undefined) {
  //     // Fallback to translations cache
  //     const dictionaryOptions = resolveDictionaryLookupOptions(
  //       sourceEntry.options,
  //     );

  //     const target = i18nManager.lookupTranslation(
  //       locale,
  //       sourceEntry.entry,
  //       dictionaryOptions,
  //     );
  //     if (target !== undefined) {
  //       return target;
  //     }

  //     // Fallback to source entry
  //     return sourceEntry.entry;
  //   }

  //   if (isDictionaryObject(sourceObject)) {
  //     return renderDictionaryObject({
  //       sourceObject,
  //       targetObject: undefined,
  //     });
  //   }

  //   throw new Error("Dictionary object cannot be rendered");
  // }

  // function renderDictionaryObject({
  //   sourceObject,
  //   targetObject,
  // }: {
  //   sourceObject: DictionaryValue;
  //   targetObject: DictionaryValue | undefined;
  // }): DictionaryObjectTranslation {
  //   if (!isDictionaryObject(sourceObject)) {
  //     return renderObject({ sourceObject, targetObject });
  //   }
  //   const result: Record<string, DictionaryObjectTranslation> = {};
  //   const keys = new Set([
  //     ...Object.keys(sourceObject),
  //     ...(isDictionaryObject(targetObject) ? Object.keys(targetObject) : []),
  //   ]);

  //   for (const key of Array.from(keys)) {
  //     const renderedChild = renderObject({
  //       sourceObject: sourceObject[key],
  //       targetObject: isDictionaryObject(targetObject)
  //         ? targetObject[key]
  //         : undefined,
  //     });
  //     if (renderedChild !== undefined) {
  //       result[key] = renderedChild;
  //     }
  //   }

  //   return result;
  // }

  return t;
}
