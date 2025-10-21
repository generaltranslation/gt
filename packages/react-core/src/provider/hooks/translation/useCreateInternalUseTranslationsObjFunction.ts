import { useCallback } from 'react';
import { TranslateIcuCallback } from '../../../types-dir/runtime';
import {
  Dictionary,
  DictionaryTranslationOptions,
  TranslatedChildren,
  Translations,
} from '../../../types-dir/types';
import {
  createEmptyIdError,
  createNoEntryFoundWarning,
} from '../../../errors-dir/createErrors';
import {
  getSubtree,
  getSubtreeWithCreation,
} from '../../../dictionaries/getSubtree';
import { isDictionaryEntry } from '../../../dictionaries/isDictionaryEntry';
import { stripMetadataFromEntries } from '../../../dictionaries/stripMetadataFromEntries';
import mergeDictionaries from '../../../dictionaries/mergeDictionaries';
import { mergeResultsIntoDictionary } from '../../../dictionaries/injectEntry';
import { injectHashes } from '../../../dictionaries/injectHashes';
import { collectUntranslatedEntries } from '../../../dictionaries/collectUntranslatedEntries';
import { injectTranslations } from '../../../dictionaries/injectTranslations';
import { injectFallbacks } from '../../../dictionaries/injectFallbacks';
import { injectAndMerge } from '../../../dictionaries/injectAndMerge';

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
  ];
  return useCallback(
    (
      id: string,
      idWithParent: string,
      options: DictionaryTranslationOptions = {}
    ): any => {
      if (idWithParent === '') {
        throw new Error(createEmptyIdError());
      }
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
      const translatedSubtree = getSubtreeWithCreation({
        dictionary: dictionaryTranslations,
        id: idWithParent,
        sourceDictionary: dictionaryTranslations,
      });

      // (2) Calculate subtreeWithHashes, dictionaryTranslationsWithTranslations, translatedSubtreeWithFallbacks, and untranslatedEntries
      // Note: the following four operations can technically be combined into one traversal, but this
      // strategy is much more readable and much easier to test/debug
      // Inject hashes into subtree
      const { dictionary: subtreeWithHashes, updateDictionary } = injectHashes(
        // eslint-disable-next-line no-undef
        structuredClone(subtree) as Dictionary,
        idWithParent
      );
      // Collect untranslated entries
      const untranslatedEntries = collectUntranslatedEntries(
        subtreeWithHashes as Dictionary,
        translatedSubtree as Dictionary,
        idWithParent
      );
      // Inject translations into translation subtree
      const {
        dictionary: dictionaryTranslationsWithTranslations,
        updateDictionary: updateDictionaryTranslations,
      } = injectTranslations(
        subtreeWithHashes as Dictionary,
        // eslint-disable-next-line no-undef
        structuredClone(translatedSubtree) as Dictionary,
        translations || {},
        untranslatedEntries,
        idWithParent
      );
      // Inject fallbacks into translation subtree
      const translatedSubtreeWithFallbacks = injectFallbacks(
        subtreeWithHashes as Dictionary,
        // eslint-disable-next-line no-undef
        structuredClone(dictionaryTranslationsWithTranslations) as Dictionary,
        untranslatedEntries,
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

      // (4) Update the dictionaryTranslations object and dictionary
      // inject translatedSubtreeWithFallbacks and new subtree objects
      // Need the setTimeout to avoid render-phase updates
      if (updateDictionary) {
        setTimeout(() => {
          setDictionary((prev: Dictionary) =>
            injectAndMerge(prev, subtreeWithHashes, idWithParent)
          );
        }, 0);
      }
      if (updateDictionaryTranslations) {
        setTimeout(() => {
          setDictionaryTranslations((prev: Dictionary) =>
            mergeDictionaries(prev, dictionaryTranslationsWithTranslations)
          );
        }, 0);
      }

      // (5) Copy the dictionaryTranslations object
      // eslint-disable-next-line no-undef
      return structuredClone(translatedSubtreeWithFallbacks);
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
