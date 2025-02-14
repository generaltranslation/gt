'use client';
import React, { isValidElement, useCallback, useEffect, useState } from 'react';
import {
  determineLocale,
  renderContentToString,
  splitStringToContent,
} from 'generaltranslation';
import { GTContext } from './GTContext';
import {
  ClientProviderProps,
  GTTranslationError,
  TaggedDictionary,
  TaggedDictionaryEntry,
  TranslatedChildren,
  TranslatedContent,
  TranslationError,
  TranslationsObject,
  TranslationSuccess,
} from '../types/types';
import extractEntryMetadata from './helpers/getEntryAndMetadata';
import renderDefaultChildren from './rendering/renderDefaultChildren';
import renderSkeleton from './rendering/renderSkeleton';
import renderTranslatedChildren from './rendering/renderTranslatedChildren';
import { isEmptyReactFragment } from '../utils/utils';
import renderVariable from './rendering/renderVariable';
import useRuntimeTranslation from './runtime/useRuntimeTranslation';
import { localeCookieName } from 'generaltranslation/internal';
import { dictionaryDisabledError } from '../messages/createMessages';

// meant to be used inside the server-side <GTProvider>
export default function ClientProvider({
  children,
  dictionary,
  initialTranslations,
  translationPromises,
  locale: _locale,
  _versionId,
  dictionaryEnabled = false,
  defaultLocale,
  translationRequired,
  dialectTranslationRequired,
  locales = [],
  requiredPrefix,
  renderSettings,
  projectId,
  devApiKey,
  runtimeUrl,
  translationEnabled,
  runtimeTranslationEnabled,
  onLocaleChange = () => {},
  cookieName = localeCookieName,
}: ClientProviderProps): React.JSX.Element {
  // ----- TRANSLATIONS STATE ----- //

  /**
   * (a) Cache has already been checked by server at this point
   * (b) All string dictionary translations have been resolved at this point
   * (c) JSX dictionary entries are either (1) resolved (so success/error) or (2) not resolved/not yet requested.
   *     They will NOT be loading at this point.
   */
  const [translations, setTranslations] = useState<TranslationsObject | null>(
    devApiKey ? null : initialTranslations
  );

  // ----- LOCALE STATE ----- //
  // Maintain the locale state
  const [locale, _setLocale] = useState<string>(
    _locale ? determineLocale(_locale, locales) || '' : ''
  );

  // Check for an invalid cookie and correct it
  useEffect(() => {
    const cookieLocale = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${cookieName}=`))
      ?.split('=')[1];
    if (
      locale &&
      (cookieLocale || cookieLocale === '') &&
      cookieLocale !== locale
    ) {
      document.cookie = `${cookieName}=${locale};path=/`;
    }
  }, [locale]);

  // Set the locale via cookies and refresh the page to reload server-side. Make sure the language is supported.
  const setLocale = (newLocale: string): void => {
    // validate locale
    newLocale = determineLocale(newLocale, locales) || locale || defaultLocale;

    // persist locale
    document.cookie = `${cookieName}=${newLocale};path=/`;

    // set locale
    _setLocale(newLocale);

    // re-render server components
    onLocaleChange();

    // re-render client components
    window.location.reload();
  };

  // ----- TRANSLATION LIFECYCLE ----- //

  // Fetch additional translations and queue them for merging
  useEffect(() => {
    setTranslations((prev) => ({ ...prev, ...initialTranslations }));
    let storeResult = true;
    const resolvedTranslations: TranslationsObject = {};
    (async () => {
      // resolve all translation promises (jsx only)
      await Promise.all(
        Object.entries(translationPromises).map(async ([key, promise]) => {
          let result: TranslationSuccess | TranslationError;
          try {
            result = { state: 'success', target: await promise };
          } catch (error) {
            console.error(error);
            // set all promise ids to error in translations
            if (error instanceof GTTranslationError) {
              result = error.toTranslationError();
            } else {
              result = { state: 'error', error: 'An error occured', code: 500 };
            }
          }
          resolvedTranslations[key] = result;
        })
      );
      // add resolved translations to state
      if (storeResult) {
        setTranslations((prev) => ({
          ...initialTranslations,
          ...prev,
          ...resolvedTranslations,
        }));
      }
    })();

    return () => {
      // cleanup
      storeResult = false;
    };
  }, [initialTranslations, translationPromises]);

  // ----- TRANSLATION METHODS ----- //

  // for dictionaries (strings are actually already resolved, but JSX needs tx still)
  const translateDictionaryEntry = useCallback(
    (
      id: string,
      options: Record<string, any> = {}
    ): React.ReactNode | string | undefined => {
      // ----- SETUP ----- //

      if (!dictionaryEnabled) {
        if (process.env.NODE_ENV === 'production') {
          console.error(dictionaryDisabledError);
          return undefined;
        } else {
          throw new Error(dictionaryDisabledError);
        }
      }

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
      const { entry, metadata } = extractEntryMetadata(dictionaryEntry);
      const variables = options;
      const variablesOptions = metadata?.variablesOptions;

      // Get the translation entry
      const translationEntry =
        translations?.[metadata?.hash || ''] || translations?.[id];

      // ----- RENDER STRINGS ----- //

      if (typeof entry === 'string') {
        // Reject empty strings
        if (!entry.length) {
          console.warn(
            `gt-next warn: Empty string found in dictionary with key: ${id}`
          );
          return entry;
        }

        // Handle fallback cases
        const content = splitStringToContent(entry);
        if (
          !translationRequired || // no translation required
          !translationEntry || // error behavior: no translation found
          translationEntry?.state !== 'success' // error behavior: translation did not resolve (loading state wont happen here)
        ) {
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

      // ----- RENDER METHODS FOR JSX ----- //
      const taggedChildren = entry;

      // for default/fallback rendering
      const renderDefaultLocale = () => {
        return renderDefaultChildren({
          children: taggedChildren,
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
          source: taggedChildren,
          target,
          variables,
          variablesOptions,
          locales: [locale, defaultLocale],
          renderVariable,
        }) as React.JSX.Element;
      };

      // ----- RENDER JSX ----- //

      // fallback if:
      if (
        !translationRequired || // no translation required
        (translations && !translationEntry && !runtimeTranslationEnabled) // cache miss and dev runtime translation disabled (production)
      ) {
        return <React.Fragment>{renderDefaultLocale()}</React.Fragment>;
      }

      // loading behavior: no translation found or translation is loading
      if (!translationEntry || translationEntry?.state === 'loading') {
        let loadingFallback;
        if (renderSettings.method === 'skeleton') {
          loadingFallback = renderSkeleton();
        } else if (renderSettings.method === 'replace') {
          loadingFallback = renderDefaultLocale();
        } else {
          // default
          loadingFallback = renderLoadingDefault();
        }
        // The suspense exists here for hydration reasons
        return <React.Fragment>{loadingFallback}</React.Fragment>;
      }

      // error behavior
      if (translationEntry.state === 'error') {
        // Reject empty fragments
        if (isEmptyReactFragment(entry)) {
          console.warn(
            `gt-next warn: Empty fragment found in dictionary with id: ${id}`
          );
          return entry;
        }
        return <React.Fragment>{renderDefaultLocale()}</React.Fragment>;
      }
      // render translated content
      return (
        <React.Fragment>
          {renderTranslation(translationEntry.target)}
        </React.Fragment>
      );
    },
    [dictionary, translations, locale]
  );

  // For <T> components
  const { translateChildren, translateContent } = useRuntimeTranslation({
    locale: locale,
    versionId: _versionId,
    projectId,
    devApiKey,
    runtimeUrl,
    setTranslations,
    defaultLocale,
    renderSettings,
    runtimeTranslationEnabled,
  });

  return (
    <GTContext.Provider
      value={{
        translateDictionaryEntry,
        translateChildren,
        translateContent,
        setLocale,
        locale,
        locales,
        defaultLocale,
        translations,
        translationRequired,
        dialectTranslationRequired,
        renderSettings,
        translationEnabled,
        runtimeTranslationEnabled,
      }}
    >
      {(!translationRequired || !translationEnabled || translations) &&
        children}
    </GTContext.Provider>
  );
}
