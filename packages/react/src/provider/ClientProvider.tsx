'use client';
import React, { isValidElement, useCallback, useEffect, useState } from 'react';
import {
  determineLocale,
  renderContentToString,
  splitStringToContent,
} from 'generaltranslation';
import { GTContext } from './GTContext';
import { ClientProviderProps } from '../types/providers';
import {
  GTTranslationError,
  TaggedDictionary,
  TaggedDictionaryEntry,
  TranslatedChildren,
  TranslatedContent,
  TranslationError,
  TranslationsObject,
  TranslationSuccess,
} from '../types/types';
import getEntryAndMetadata from './helpers/getEntryAndMetadata';
import renderDefaultChildren from './rendering/renderDefaultChildren';
import renderSkeleton from './rendering/renderSkeleton';
import renderTranslatedChildren from './rendering/renderTranslatedChildren';
import renderVariable from './rendering/renderVariable';
import useRuntimeTranslation from '../hooks/internal/useRuntimeTranslation';
import { localeCookieName } from 'generaltranslation/internal';
import useTranslateContent from '../hooks/internal/useTranslateContent';

// meant to be used inside the server-side <GTProvider>
export default function ClientProvider({
  children,
  dictionary,
  initialTranslations,
  translationPromises,
  locale: _locale,
  _versionId,
  defaultLocale,
  translationRequired,
  dialectTranslationRequired,
  locales = [],
  requiredPrefix,
  renderSettings,
  projectId,
  devApiKey,
  runtimeUrl,
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
    if (locale && cookieLocale && cookieLocale !== locale) {
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

  // ---------- TRANSLATION METHODS ---------- //

  // for dictionaries (strings are actually already resolved, but JSX needs tx still)
  const getDictionaryEntryTranslation = useCallback(
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
      const translation = translations?.[metadata?.hash];

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
        (translations && !translation && !runtimeTranslationEnabled) // cache miss and dev runtime translation disabled (production)
      ) {
        return <React.Fragment>{renderDefaultLocale()}</React.Fragment>;
      }

      // loading behavior: no translation found or translation is loading
      if (!translation || translation?.state === 'loading') {
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
      if (translation.state === 'error') {
        return <React.Fragment>{renderDefaultLocale()}</React.Fragment>;
      }
      // render translated content
      return (
        <React.Fragment>{renderTranslation(translation.target)}</React.Fragment>
      );
    },
    [dictionary, translations, locale]
  );

  // Translate content function
  const translateContent = useTranslateContent(
    translations,
    locale,
    defaultLocale,
    translationRequired
  );

  // Setup runtime translation
  const { registerContentForTranslation, registerJsxForTranslation } =
    useRuntimeTranslation({
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
        registerContentForTranslation,
        registerJsxForTranslation,
        setLocale,
        translateContent,
        getDictionaryEntryTranslation,
        locale,
        locales,
        defaultLocale,
        translations,
        translationRequired,
        dialectTranslationRequired,
        renderSettings,
        runtimeTranslationEnabled,
      }}
    >
      {(!translationRequired || translations) && children}
    </GTContext.Provider>
  );
}
