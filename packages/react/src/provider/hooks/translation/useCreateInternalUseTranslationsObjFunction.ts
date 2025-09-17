import { useCallback } from 'react';
import { TranslateIcuCallback } from '../../../types/runtime';
import {
  Dictionary,
  DictionaryEntry,
  DictionaryTranslationOptions,
  TranslatedChild,
  TranslatedChildren,
  Translations,
} from '../../../types/types';
import { createNoEntryFoundWarning } from '../../../errors/createErrors';
import {
  getSubtree,
  getSubtreeWithCreation,
} from '../../../dictionaries/getSubtree';
import { isDictionaryEntry } from '../../../dictionaries/isDictionaryEntry';
import { GT } from 'generaltranslation';
import { stripMetadataFromEntries } from '../../../dictionaries/stripMetadataFromEntries';
import mergeDictionaries from '../../../dictionaries/mergeDictionaries';
import { constructTranslationSubtree } from '../../../dictionaries/constructTranslationSubtree';
import { mergeResultsIntoDictionary } from '../../../dictionaries/injectEntry';

export function useCreateInternalUseTranslationsObjFunction(
  dictionary: Dictionary,
  dictionaryTranslations: Dictionary,
  setDictionary: Function,
  setDictionaryTranslations: Function,
  translations: Translations | null,
  locale: string,
  defaultLocale: string,
  translationRequired: boolean,
  dialectTranslationRequired: boolean,
  developmentApiEnabled: boolean,
  registerIcuForTranslation: TranslateIcuCallback,
  tFunction: (id: string, options: DictionaryTranslationOptions) => string
) {
  return useCallback(
    (
      id: string,
      idWithParent: string,
      options: DictionaryTranslationOptions = {}
    ): any => {
      // (1) Get subtree
      const subtree = getSubtree({
        dictionary,
        id: idWithParent,
      });
      // Check: no subtree found
      if (!subtree) {
        console.warn(createNoEntryFoundWarning(idWithParent));
        return {};
      }
      // Check: if subTreeTranslation is a dictionaryEntry
      if (isDictionaryEntry(subtree)) {
        return tFunction(id, options);
      }
      // Check: if is default locale
      if (!translationRequired) {
        // remove metadata from entries
        return stripMetadataFromEntries(subtree);
      }
      const subTreeTranslation = getSubtreeWithCreation({
        dictionary: dictionaryTranslations,
        id: idWithParent,
        sourceDictionary: dictionaryTranslations,
      });

      // (2) Inject hashes into subtree and inject translation into translation subtree and get untransalted entries
      const { untranslatedEntries } = constructTranslationSubtree(
        subtree as Dictionary,
        subTreeTranslation as Dictionary,
        translations || {},
        idWithParent
      );

      // (3) For each untranslated entry, translate it
      if (developmentApiEnabled) {
        Promise.allSettled(
          untranslatedEntries.map(
            async (
              untranslatedEntry
            ): Promise<[string, TranslatedChildren]> => {
              const { source, metadata } = untranslatedEntry;
              const id = metadata?.$id;
              return [
                id,
                await registerIcuForTranslation({
                  source,
                  targetLocale: locale,
                  metadata: {
                    ...(metadata?.$context && { context: metadata.$context }),
                    id,
                    hash: metadata?.$_hash,
                  },
                }),
              ];
            }
          )
        ).then((settledResults) => {
          // Filter out only successful promises and extract their values
          const successfulResults: [string, TranslatedChildren][] =
            settledResults
              .filter(
                (
                  result
                ): result is PromiseFulfilledResult<
                  [string, TranslatedChildren]
                > => result.status === 'fulfilled'
              )
              .map((result) => result.value);
          // Only proceed if we have successful results
          if (successfulResults.length > 0) {
            // Merge the results into the dictionaryTranslations object
            setDictionaryTranslations((prev: Dictionary) =>
              mergeResultsIntoDictionary(prev, successfulResults, dictionary)
            );
          }
        });
      }

      // (5) Copy the dictionaryTranslations object
      // eslint-disable-next-line no-undef
      return structuredClone(subTreeTranslation);
    },
    [
      dictionary,
      translations,
      locale,
      defaultLocale,
      translationRequired,
      dialectTranslationRequired,
      developmentApiEnabled,
      registerIcuForTranslation,
      dictionaryTranslations,
    ]
  );
}
