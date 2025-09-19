import { useCallback } from 'react';
import {
  Dictionary,
  DictionaryTranslationOptions,
  Translations,
} from '../../../types/types';
import {
  getDictionaryEntry,
  isValidDictionaryEntry,
} from '../../../dictionaries/getDictionaryEntry';
import getEntryAndMetadata from '../../../dictionaries/getEntryAndMetadata';
import {
  createInvalidDictionaryEntryWarning,
  createNoEntryFoundWarning,
} from '../../../errors/createErrors';
import { hashSource } from 'generaltranslation/id';
import { formatMessage } from 'generaltranslation';
import { TranslateIcuCallback } from '../../../types/runtime';

export default function useCreateInternalUseTranslationsFunction(
  dictionary: Dictionary | undefined,
  dictionaryTranslations: Dictionary | undefined,
  translations: Translations | null,
  locale: string,
  defaultLocale: string,
  translationRequired: boolean,
  dialectTranslationRequired: boolean,
  developmentApiEnabled: boolean,
  registerIcuForTranslation: TranslateIcuCallback
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
      const renderMessage = (message: string, locales: string[]) => {
        return formatMessage(message, {
          locales,
          variables: options,
        });
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
        return renderMessage(entry || '', [locale, defaultLocale]);
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
        return renderMessage(translationEntry as string, [
          locale,
          defaultLocale,
        ]);
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

      // Don't translate non-string entries
      if (typeof entry !== 'string') {
        return renderMessage(entry, [defaultLocale]);
      }

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
