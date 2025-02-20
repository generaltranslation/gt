import { isValidElement, useCallback } from 'react';
import {
  FlattenedTaggedDictionary,
  TaggedDictionary,
  TaggedDictionaryEntry,
  TranslatedChildren,
  TranslatedContent,
  TranslationsObject,
} from '../../types/types';
import getEntryAndMetadata from '../../provider/helpers/getEntryAndMetadata';
import {
  renderContentToString,
  splitStringToContent,
} from 'generaltranslation';
import renderDefaultChildren from '../../provider/rendering/renderDefaultChildren';
import renderSkeleton from '../../provider/rendering/renderSkeleton';
import renderTranslatedChildren from '../../provider/rendering/renderTranslatedChildren';
import React from 'react';
import renderVariable from '../../provider/rendering/renderVariable';

export default function useTranslateEntryFromServer({
  dictionary,
  translations,
  locale,
  renderSettings,
  runtimeTranslationEnabled,
  translationRequired,
  dialectTranslationRequired,
  locales,
  defaultLocale,
}: {
  dictionary: FlattenedTaggedDictionary;
  translations: TranslationsObject | null;
  locale: string;
  translationRequired: boolean;
  defaultLocale: string;
  locales: string[];
  renderSettings: { method: string; timeout?: number };
  runtimeTranslationEnabled: boolean;
  dialectTranslationRequired: boolean;
}) {
  return useCallback(
    (
      id: string,
      options: Record<string, any> = {}
    ): React.ReactNode | string | undefined => {
      // ----- SETUP ----- //

      // Get the dictionary entry
      const dictionaryEntry:
        | TaggedDictionary
        | TaggedDictionaryEntry
        | undefined = dictionary[id]; // this is a flattened dictionary
      if (
        (!dictionaryEntry && dictionaryEntry !== '') || // entry not found
        (typeof dictionaryEntry === 'object' &&
          !isValidElement(dictionaryEntry) &&
          !Array.isArray(dictionaryEntry))
      ) {
        return undefined; // dictionary entry not found
      }

      // Parse the dictionary entry
      const { entry, metadata } = getEntryAndMetadata(dictionaryEntry);
      const variables = options;
      const variablesOptions = metadata?.variablesOptions;

      // Get the translation entry
      const translationEntry = translations?.[metadata?.hash];

      // ---------- HANDLE STRINGS ---------- //

      if (typeof entry === 'string') {
        // Reject empty strings
        if (!entry.length) {
          console.warn(
            `gt-react warn: Empty string found in dictionary with id: ${id}`
          );
          return entry;
        }

        // Split string to content
        const source = splitStringToContent(entry);

        // Error handling
        if (
          !translationRequired || // If no translation required
          translationEntry?.state !== 'success' // If translation was unsuccessful
        ) {
          return renderContentToString(
            source,
            locales,
            variables,
            variablesOptions
          );
        }

        // Display translated content
        return renderContentToString(
          translationEntry.target as TranslatedContent,
          [locale, defaultLocale],
          variables,
          variablesOptions
        );
      }

      // ---------- HANDLE JSX ---------- //

      // ----- RENDER METHODS ----- //

      // for default/fallback rendering
      const renderDefaultLocale = () => {
        return renderDefaultChildren({
          children: entry,
          variables,
          variablesOptions,
          defaultLocale,
          renderVariable,
        });
      };

      const renderLoadingDefault = () => {
        if (dialectTranslationRequired) {
          return renderDefaultLocale();
        }
        return renderSkeleton();
      };

      const renderTranslation = (target: TranslatedChildren) => {
        return renderTranslatedChildren({
          source: entry,
          target,
          variables,
          variablesOptions,
          locales: [locale, defaultLocale],
          renderVariable,
        }) as React.JSX.Element;
      };

      // ----- VALIDATION ----- //

      // Validate that:
      if (
        !translationRequired || // translation required
        !locale // there exists a locale to translate to
      ) {
        return <React.Fragment>{renderDefaultLocale()}</React.Fragment>;
      }

      // ----- RENDER BEHAVIOR ----- //

      // Success
      if (translationEntry?.state === 'success') {
        return (
          <React.Fragment>
            {renderTranslation(translationEntry.target)}
          </React.Fragment>
        );
      }

      // Loading behavior
      if (
        !translations || // checking cache
        translationEntry?.state === 'loading' // translating on demand (dev only)
      ) {
        if (renderSettings.method === 'skeleton') {
          return <React.Fragment>{renderSkeleton()}</React.Fragment>;
        } else if (renderSettings.method === 'replace') {
          return <React.Fragment>{renderDefaultLocale()}</React.Fragment>;
        }
        return <React.Fragment>{renderLoadingDefault()}</React.Fragment>;
      }

      // Error behavior: (1) translation failed (2) translation not found
      return <React.Fragment>{renderDefaultLocale()}</React.Fragment>;
    },
    [
      dictionary,
      translations,
      locale,
      renderSettings,
      runtimeTranslationEnabled,
      translationRequired,
      dialectTranslationRequired,
      locales,
      defaultLocale,
    ]
  );
}
