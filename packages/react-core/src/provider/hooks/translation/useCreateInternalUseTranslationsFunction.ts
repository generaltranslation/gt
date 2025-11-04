import { useCallback } from 'react';
import {
  Dictionary,
  DictionaryTranslationOptions,
  Translations,
} from '../../../types-dir/types';
import {
  getDictionaryEntry,
  isValidDictionaryEntry,
} from '../../../dictionaries/getDictionaryEntry';
import getEntryAndMetadata from '../../../dictionaries/getEntryAndMetadata';
import {
  createInvalidDictionaryEntryWarning,
  createInvalidIcuDictionaryEntryError,
  createInvalidIcuDictionaryEntryWarning,
  createNoEntryFoundWarning,
} from '../../../errors-dir/createErrors';
import { hashSource } from 'generaltranslation/id';
import { GT } from 'generaltranslation';
import { TranslateIcuCallback } from '../../../types-dir/runtime';

export default function useCreateInternalUseTranslationsFunction(
  gt: GT,
  dictionary: Dictionary | undefined,
  dictionaryTranslations: Dictionary | undefined,
  translations: Translations | null,
  locale: string,
  defaultLocale: string,
  translationRequired: boolean,
  dialectTranslationRequired: boolean,
  developmentApiEnabled: boolean,
  registerIcuForTranslation: TranslateIcuCallback,
  environment: 'development' | 'production' | 'test'
) {
  return useCallback(
    (id: string, options: DictionaryTranslationOptions = {}): string => {
      // Check: dictionary exists
      if (!dictionary) {
        return '';
      }

      // Get entry
      const value = getDictionaryEntry(dictionary, id);

      // Check: no entry found
      if (!value) {
        console.warn(createNoEntryFoundWarning(id));
        return '';
      }

      // Check: invalid entry
      if (!isValidDictionaryEntry(value)) {
        console.warn(createInvalidDictionaryEntryWarning(id));
        return '';
      }

      // Get entry and metadata
      const { entry, metadata } = getEntryAndMetadata(value);

      // ----- SET UP ----- //

      // Check: reject invalid content
      if (!entry || typeof entry !== 'string') return '';

      // Render method
      const renderMessage = (
        message: string,
        locales: string[],
        fallback?: string
      ) => {
        try {
          // (1) Try to format message
          return gt.formatMessage(message, {
            locales,
            variables: options,
          });
        } catch (error) {
          if (environment === 'production') {
            console.warn(
              createInvalidIcuDictionaryEntryWarning(id),
              'Error: ',
              error
            );
          } else {
            // (3) If no fallback, throw error (non-prod)
            if (!fallback)
              throw new Error(
                `${createInvalidIcuDictionaryEntryError(id)} Error: ${error}`
              );

            console.error(
              createInvalidIcuDictionaryEntryError(id),
              'Error: ',
              error
            );
          }

          // (2) If format fails, format fallback
          if (fallback) {
            return renderMessage(fallback, locales);
          }

          // (3) Fallback to original message (unformatted)
          return message; // fallback to original message (unformatted)}
        }
      };

      // Check: translation not required
      if (!translationRequired) return renderMessage(entry, [defaultLocale]);

      // ----- CHECK DICTIONARY TRANSLATIONS ----- //
      const dictionaryTranslation = getDictionaryEntry(
        dictionaryTranslations || {},
        id
      );
      if (
        dictionaryTranslation &&
        isValidDictionaryEntry(dictionaryTranslation)
      ) {
        const { entry } = getEntryAndMetadata(dictionaryTranslation);
        return renderMessage(entry, [locale, defaultLocale]);
      }

      // ----- CHECK TRANSLATIONS ----- //

      let translationEntry = translations?.[id];
      let hash = '';
      const getHash = () =>
        hashSource({
          source: entry,
          ...(metadata?.$context && { context: metadata.$context }),
          id,
          dataFormat: 'ICU',
        });
      if (!translationEntry) {
        hash = getHash();
        translationEntry = translations?.[hash];
      }

      // Check translation successful
      if (translationEntry) {
        return renderMessage(
          translationEntry as string,
          [locale, defaultLocale],
          entry
        );
      }

      if (translationEntry === null) {
        return renderMessage(entry, [defaultLocale]);
      }

      // Check if runtime translation is enabled
      if (!developmentApiEnabled) {
        return renderMessage(entry, [defaultLocale]);
      }

      // ----- TRANSLATE ON DEMAND ----- //
      // development only

      // Translate Content
      registerIcuForTranslation({
        source: entry,
        targetLocale: locale,
        metadata: {
          ...(metadata?.$context && { context: metadata.$context }),
          id,
          hash: hash || getHash(),
        },
      });

      // renderSettings.method must be ignored because t() is synchronous &
      // t() should never return an empty string because functions reason about strings based on falsiness
      return renderMessage(entry, [defaultLocale]);
    },
    [
      dictionary,
      dictionaryTranslations,
      translations,
      locale,
      defaultLocale,
      translationRequired,
      developmentApiEnabled,
      registerIcuForTranslation,
      dialectTranslationRequired,
    ]
  );
}
