import { useCallback } from 'react';
import {
  DictionaryEntry,
  FlattenedContentDictionary,
  FlattenedDictionary,
  TranslatedContent,
  TranslationsObject,
} from '../../types/types';
import getDictionaryEntry from '../../provider/helpers/getDictionaryEntry';
import getEntryAndMetadata from '../../provider/helpers/getEntryAndMetadata';
import T from '../../translation/inline/T';
import {
  renderContentToString,
  splitStringToContent,
} from 'generaltranslation';

export default function useTranslateEntry({
  dictionary,
  translations,
  translationRequired,
  locale,
  defaultLocale,
  flattenedDictionary,
  flattenedDictionaryContentEntries,
  locales,
}: {
  dictionary: any;
  translations: TranslationsObject | null;
  translationRequired: boolean;
  locale: string;
  defaultLocale: string;
  flattenedDictionary: FlattenedDictionary;
  flattenedDictionaryContentEntries: FlattenedContentDictionary;
  locales: string[];
}) {
  return useCallback(
    (id: string, options: Record<string, any> = {}): React.ReactNode => {
      // ----- SETUP ----- //

      // Get dictionary entry
      const entryWithMetadata: DictionaryEntry | undefined = getDictionaryEntry(
        flattenedDictionary,
        id
      );
      if (!entryWithMetadata) return undefined; // Dictionary entry not found

      // Get the entry, metadata, and variables
      const { entry, metadata } = getEntryAndMetadata(entryWithMetadata);
      const variables = options;
      const variablesOptions = metadata?.variablesOptions;

      // ----- HANDLE STRINGS ----- //

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

        // Check if target exists
        const translation =
          translations?.[flattenedDictionaryContentEntries[id]?.hash];

        // Error handling
        if (
          !translationRequired || // If no translation required
          translation?.state !== 'success' // If translation was unsuccessful
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
          translation.target as TranslatedContent,
          [locale, defaultLocale],
          variables,
          variablesOptions
        );
      }

      // ----- HANDLE JSX ----- //

      return (
        <T
          id={id}
          variables={variables}
          variablesOptions={variablesOptions}
          {...metadata}
        >
          {entry}
        </T>
      );
    },
    [
      dictionary,
      translations,
      translationRequired,
      locale,
      defaultLocale,
      flattenedDictionary,
      flattenedDictionaryContentEntries,
      locales,
    ]
  );
}
