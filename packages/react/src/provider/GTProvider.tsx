import { useMemo } from 'react';
import {
  isSameLanguage,
  renderContentToString,
  requiresTranslation,
  splitStringToContent,
} from 'generaltranslation';
import { useCallback, useEffect, useState } from 'react';
import useBrowserLocale from '../hooks/useBrowserLocale';
import { GTContext } from './GTContext';
import {
  DictionaryEntry,
  RenderMethod,
  TranslatedContent,
  TranslationsObject,
} from '../types/types';
import getDictionaryEntry from './helpers/getDictionaryEntry';
import { flattenDictionary, isEmptyReactFragment } from '../internal';
import extractEntryMetadata from './helpers/extractEntryMetadata';
import {
  Content,
  defaultCacheUrl,
  defaultRuntimeApiUrl,
  libraryDefaultLocale,
} from 'generaltranslation/internal';
import { projectIdMissingError } from '../messages/createMessages';
import { listSupportedLocales } from '@generaltranslation/supported-locales';
import useRuntimeTranslation from './runtime/useRuntimeTranslation';
import { defaultRenderSettings } from './rendering/defaultRenderSettings';
import { hashJsxChildren } from 'generaltranslation/id';
import React from 'react';
import T from '../inline/T';

/**
 * Provides General Translation context to its children, which can then access `useGT`, `useLocale`, and `useDefaultLocale`.
 *
 * @param {React.ReactNode} children - The children components that will use the translation context.
 * @param {string} [projectId] - The project ID required for General Translation cloud services.
 * @param {Dictionary} [dictionary=defaultDictionary] - The translation dictionary for the project.
 * @param {string[]} [locales] - The list of approved locales for the project.
 * @param {string} [defaultLocale=libraryDefaultLocale] - The default locale to use if no other locale is found.
 * @param {string} [locale] - The current locale, if already set.
 * @param {string} [cacheUrl='https://cache.gtx.dev'] - The URL of the cache service for fetching translations.
 *
 * @returns {JSX.Element} The provider component for General Translation context.
 */

export default function GTProvider({
  children,
  projectId,
  dictionary = {},
  locales = listSupportedLocales(),
  defaultLocale = libraryDefaultLocale,
  locale = useBrowserLocale(defaultLocale, locales),
  cacheUrl = defaultCacheUrl,
  runtimeUrl = defaultRuntimeApiUrl,
  renderSettings = defaultRenderSettings,
  devApiKey,
  ...metadata
}: {
  children?: React.ReactNode;
  projectId: string;
  dictionary?: any;
  locales?: string[];
  defaultLocale?: string;
  locale?: string;
  cacheUrl?: string;
  runtimeUrl?: string;
  devApiKey?: string;
  renderSettings?: {
    method: RenderMethod;
    timeout?: number;
  };
  [key: string]: any;
}): React.JSX.Element {
  if (
    !projectId &&
    (cacheUrl === defaultCacheUrl || runtimeUrl === defaultRuntimeApiUrl)
  ) {
    throw new Error(projectIdMissingError);
  }

  if (
    renderSettings.timeout === undefined &&
    defaultRenderSettings.timeout !== undefined
  ) {
    renderSettings.timeout = defaultRenderSettings.timeout;
  }

  // get tx required info
  const [translationRequired, dialectTranslationRequired] = useMemo(() => {
    const translationRequired = requiresTranslation(
      defaultLocale,
      locale,
      locales
    );
    const dialectTranslationRequired =
      translationRequired && isSameLanguage(defaultLocale, locale);
    return [translationRequired, dialectTranslationRequired];
  }, [defaultLocale, locale, locales]);

  // tracking translations
  /** Key for translation tracking:
   * Cache Loading            -> translations = null
   * Cache Fail (for locale)  -> translations = {}
   * Cache Fail (for id)      -> translations[id] = undefined
   * Cache Fail (for hash)    -> translations[id][hash] = undefined
   *
   * API Loading              -> translations[id][hash] = TranslationLoading
   * API Fail (for batch)     -> translations[id][hash] = TranslationError
   * API Fail (for hash)      -> translations[id][hash] = TranslationError
   *
   * Success (Cache/API)      -> translations[id][hash] = TranslationSuccess
   *
   * Possible scenarios:
   * Cache Loading -> Success
   * Cache Loading -> Cache Fail -> API Loading -> Success
   * Cache Loading -> Cache Fail -> API Loading -> API Fail
   */
  const [translations, setTranslations] = useState<TranslationsObject | null>(
    cacheUrl && translationRequired ? null : {}
  );

  // ----- CHECK CACHE FOR TX ----- //

  useEffect(() => {
    // check if cache fetch is necessary
    if (translations || !translationRequired) return;

    // fetch translations from cache
    (async () => {
      try {
        const response = await fetch(`${cacheUrl}/${projectId}/${locale}`);
        const result = await response.json();

        // convert to translation success and record
        const parsedResult = Object.entries(result).reduce(
          (
            translationsAcc: Record<string, any>,
            [id, hashToTranslation]: [string, any]
          ) => {
            translationsAcc[id] = Object.entries(
              hashToTranslation || {}
            ).reduce((idAcc: Record<string, any>, [hash, content]) => {
              idAcc[hash] = { state: 'success', entry: content };
              return idAcc;
            }, {});
            return translationsAcc;
          },
          {}
        );
        setTranslations(parsedResult);
      } catch (error) {
        setTranslations({}); // not classified as a tx error, bc we can still fetch from API
      }
    })();
  }, [translations, translationRequired, cacheUrl, projectId, locale]);

  // ----- PERFORM DICTIONARY TRANSLATION ----- //

  // Flatten dictionaries for processing while waiting for translations
  const flattenedDictionary = useMemo(
    () => flattenDictionary(dictionary),
    [dictionary]
  );

  // Get strings that have changed
  const stringData = useMemo(() => {
    if (!translationRequired) return {};
    return Object.entries(flattenedDictionary)
      .filter(([id, entryWithMetadata]) => {
        const { entry } = extractEntryMetadata(entryWithMetadata);
        if (typeof entry === 'string') {
          if (!entry.length) {
            console.warn(
              `gt-react warn: Empty string found in dictionary with id: ${id}`
            );
            return;
          }
          return true;
        }
        return false;
      })
      .reduce(
        (
          acc: Record<string, { hash: string; source: Content }>,
          [id, entryWithMetadata]
        ) => {
          const { entry, metadata } = extractEntryMetadata(entryWithMetadata);
          const context = metadata?.context;
          const source = splitStringToContent(entry as string);
          const hash = hashJsxChildren({ source, context });
          acc[id] = { source, hash };
          return acc;
        },
        {} as Record<string, { hash: string; source: Content }>
      );
  }, [flattenedDictionary, translationRequired]);

  const [unresolvedDictionaryStringsAndHashes, dictionaryStringsResolved] =
    useMemo(() => {
      let stringIsLoading = false;
      const unresolvedDictionaryStringsAndHashes = Object.entries(
        stringData
      ).filter(([id, { hash }]) => {
        if (translations?.[id]?.[hash]?.state === 'loading')
          stringIsLoading = true;
        return !translations?.[id]?.[hash];
      });
      const dictionaryStringsResolved =
        !stringIsLoading && unresolvedDictionaryStringsAndHashes.length === 0;
      return [unresolvedDictionaryStringsAndHashes, dictionaryStringsResolved];
    }, [translations, stringData]);

  // do translation strings (API)
  // this useEffect is for translating strings in the dictionary before the page loads
  // page will block until strings are loaded (so errors or translations)
  useEffect(() => {
    // tx required or dict strings already resolved
    if (!translationRequired || !unresolvedDictionaryStringsAndHashes.length)
      return;

    // iterate through unresolvedDictionaryStringsAndHashes
    unresolvedDictionaryStringsAndHashes.forEach(([id, { hash, source }]) => {
      const { metadata } = extractEntryMetadata(flattenedDictionary[id]);
      // Translate the content
      translateContent({
        source,
        targetLocale: locale,
        metadata: {
          ...metadata,
          id,
          hash,
        },
      });
    });
    // is this already translated? if so, skip
  }, [
    translationRequired,
    unresolvedDictionaryStringsAndHashes,
    flattenedDictionary,
  ]);

  // ----- TRANSLATE FUNCTION FOR DICTIONARIES ----- //

  const translateDictionaryEntry = useCallback(
    (
      id: string,
      options: Record<string, any> = {}
    ): React.ReactNode | string | undefined => {
      // ----- SETUP ----- //

      // get the dictionary entry
      const dictionaryEntry: DictionaryEntry | undefined = getDictionaryEntry(
        flattenedDictionary,
        id
      );
      if (!dictionaryEntry && dictionaryEntry !== '') return undefined; // dictionary entry not found

      // Parse the dictionary entry
      const { entry, metadata } = extractEntryMetadata(dictionaryEntry);
      const variables = options;
      const variablesOptions = metadata?.variablesOptions;

      // ----- RENDER STRINGS ----- //

      if (typeof entry === 'string') {
        // render strings

        // Reject empty strings
        if (!entry.length) {
          console.warn(
            `gt-react warn: Empty string found in dictionary with id: ${id}`
          );
          return entry;
        }

        // no translation required
        const content = splitStringToContent(entry);
        if (!translationRequired) {
          return renderContentToString(
            content,
            locales,
            variables,
            variablesOptions
          );
        }

        // get translation entry
        const context = metadata?.context;
        const hash =
          metadata?.hash || hashJsxChildren({ source: content, context });
        const translationEntry = translations?.[id]?.[hash];

        // error behavior
        if (!translationEntry || translationEntry?.state !== 'success') {
          return renderContentToString(
            content,
            locales,
            variables,
            variablesOptions
          );
        }

        // render translated content
        return renderContentToString(
          translationEntry.target as TranslatedContent,
          [locale, defaultLocale],
          variables,
          variablesOptions
        );
      }

      // ----- RENDER JSX ----- //

      // Reject empty fragments
      if (isEmptyReactFragment(entry)) {
        console.warn(
          `gt-react warn: Empty fragment found in dictionary with id: ${id}`
        );
        return entry;
      }

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
      defaultLocale,
      flattenedDictionary,
      dictionaryStringsResolved,
    ]
  );

  const { translateChildren, translateContent, translationEnabled } =
    useRuntimeTranslation({
      targetLocale: locale,
      projectId,
      defaultLocale,
      devApiKey,
      runtimeUrl,
      renderSettings,
      setTranslations,
      ...metadata,
    });

  // hang until cache response, then render translations or loading state (when waiting on API response)
  return (
    <GTContext.Provider
      value={{
        translateDictionaryEntry,
        translateContent,
        translateChildren,
        locale,
        defaultLocale,
        translations,
        translationRequired,
        dialectTranslationRequired,
        projectId,
        translationEnabled,
        renderSettings,
      }}
    >
      {dictionaryStringsResolved && translations && children}
    </GTContext.Provider>
  );
}
