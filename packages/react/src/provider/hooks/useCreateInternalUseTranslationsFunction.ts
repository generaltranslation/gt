import { useCallback } from 'react';
import {
  Dictionary,
  DictionaryTranslationOptions,
  RenderMethod,
  TranslationsStatus,
  Translations,
} from '../../types/types';
import {
  getDictionaryEntry,
  isValidDictionaryEntry,
} from '../../dictionaries/getDictionaryEntry';
import getEntryAndMetadata from '../../dictionaries/getEntryAndMetadata';
import {
  createInvalidDictionaryEntryWarning,
  createNoEntryFoundWarning,
} from '../../errors/createErrors';
import { hashSource } from 'generaltranslation/id';
import { formatMessage } from 'generaltranslation';
import { TranslateIcuCallback } from '../../types/runtime';

export default function useCreateInternalUseTranslationsFunction(
  dictionary: Dictionary | undefined,
  translations: Translations | null,
  translationsStatus: TranslationsStatus | null,
  locale: string,
  defaultLocale: string,
  translationRequired: boolean,
  dialectTranslationRequired: boolean,
  runtimeTranslationEnabled: boolean,
  registerIcuForTranslation: TranslateIcuCallback,
  renderSettings: { method: RenderMethod }
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

      // ----- CHECK TRANSLATIONS ----- //

      // Get hash
      const hash = hashSource({
        source: entry,
        ...(metadata?.$context && { context: metadata.$context }),
        id,
        dataFormat: 'ICU',
      });

      // Check id first
      const translationEntry = translations?.[hash];
      const translationStatus = translationsStatus?.[hash];

      // Check translation successful
      if (translationStatus?.status === 'success') {
        return renderMessage(translationEntry as string, [
          locale,
          defaultLocale,
        ]);
      }

      if (translationStatus?.status === 'error') {
        return renderMessage(entry, [defaultLocale]);
      }

      // ----- TRANSLATE ON DEMAND ----- //
      // development only

      // Check if runtime translation is enabled
      if (!runtimeTranslationEnabled) {
        return renderMessage(entry, [defaultLocale]);
      }

      // Translate Content
      registerIcuForTranslation({
        source: entry,
        targetLocale: locale,
        metadata: {
          ...(metadata?.$context && { context: metadata.$context }),
          id,
          hash,
        },
      });

      // Loading behavior
      if (renderSettings.method === 'replace') {
        return renderMessage(entry, [defaultLocale]);
      } else if (renderSettings.method === 'skeleton') {
        return '';
      }
      return dialectTranslationRequired // default behavior
        ? renderMessage(entry, [defaultLocale])
        : '';
    },
    [
      dictionary,
      translations,
      translationsStatus,
      locale,
      defaultLocale,
      translationRequired,
      runtimeTranslationEnabled,
      registerIcuForTranslation,
      dialectTranslationRequired,
    ]
  );
}
