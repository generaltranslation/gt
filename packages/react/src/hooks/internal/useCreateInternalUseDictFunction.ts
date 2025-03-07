import { useCallback, useMemo, useState } from 'react';
import {
  Dictionary,
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RenderMethod,
  TranslationsObject,
} from '../../types/types';
import getDictionaryEntry, {
  isValidDictionaryEntry,
} from '../../provider/helpers/getDictionaryEntry';
import getEntryAndMetadata from '../../provider/helpers/getEntryAndMetadata';
import {
  createInvalidDictionaryEntryWarning,
  createNoEntryFoundWarning,
} from '../../messages/createMessages';
import { renderContentToString, splitStringToContent } from 'generaltranslation';
import { hashJsxChildren } from 'generaltranslation/id';
import { Content } from 'generaltranslation/internal';
import { TranslateContentCallback } from '../../types/runtime';

export default function useCreateInternalUseDictFunction(
  dictionary: Dictionary,
  translations: TranslationsObject | null,
  locale: string,
  defaultLocale: string,
  translationRequired: boolean,
  dialectTranslationRequired: boolean,
  runtimeTranslationEnabled: boolean,
  registerContentForTranslation: TranslateContentCallback,
  renderSettings: { method: RenderMethod }
) {
  return useCallback(
    (id: string, options: DictionaryTranslationOptions = {}): string => {
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

      // Parse content
      const source = splitStringToContent(entry);

      // Render method
      const renderContent = (content: Content, locales: string[]) => {
        return renderContentToString(
          content,
          locales,
          options.variables,
          options.variablesOptions
        );
      };

      // Check: translation not required
      if (!translationRequired) return renderContent(source, [defaultLocale]);

      // ----- CHECK TRANSLATIONS ----- //

      // Get hash
      let hash: string;
      const calculateHash = () => {
        if (hash) return hash;
        hash = hashJsxChildren({
          source,
          ...(metadata?.context && { context: metadata.context }),
          id,
        })
        return hash;
      };

      // Check id first
      let translationEntry = translations?.[id];

      // Check hash
      if (!translationEntry) {
        translationEntry = translations?.[calculateHash()];
      }

      // Check translation successful
      if (translationEntry?.state === 'success') {
        return renderContent(translationEntry.target as Content, [
          locale,
          defaultLocale,
        ]);
      }

      if (translationEntry?.state === 'error') {
        return renderContent(source, [defaultLocale]);
      }

      // ----- TRANSLATE ON DEMAND ----- //
      // develoment only

      // Check if runtime translation is enabled
      if (!runtimeTranslationEnabled) {
        return renderContent(source, [defaultLocale]);
      }

      // Translate Content
      registerContentForTranslation({
        source,
        targetLocale: locale,
        metadata: {
          ...(metadata?.context && { context: metadata.context }),
          id,
          hash: calculateHash(),
        },
      });

      // Loading behavior
      if (renderSettings.method === 'replace') {
        return renderContent(source, [defaultLocale]);
      } else if (renderSettings.method === 'skeleton') {
        return '';
      }
      return dialectTranslationRequired // default behavior
        ? renderContent(source, [defaultLocale])
        : '';
    },
    [
      dictionary,
      translations,
      locale,
      defaultLocale,
      translationRequired,
      runtimeTranslationEnabled,
      registerContentForTranslation,
      dialectTranslationRequired,
    ]
  );
}
