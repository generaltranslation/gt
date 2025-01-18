'use client';

import {
  useCallback,
  useLayoutEffect,
  useState,
} from 'react';
import {
  GTContext, useDynamicTranslation
} from 'gt-react/client';
import { renderDefaultChildren, renderTranslatedChildren, Dictionary, RenderMethod, renderSkeleton, isTranslationError, TranslationsObject } from 'gt-react/internal';
import { extractEntryMetadata } from 'gt-react/internal';
import { renderContentToString } from 'generaltranslation';
import renderVariable from '../server/rendering/renderVariable';
import { createNoEntryWarning, createRequiredPrefixError } from '../errors/createErrors';
import { Translations } from '../types/types';
import { isTranslationPromise } from '../utils/checkTypes';

// meant to be used inside the server-side <GTProvider>
export default function ClientProvider({
  children,
  dictionary,
  initialTranslations,
  locale,
  defaultLocale,
  translationRequired,
  regionalTranslationRequired,
  requiredPrefix,
  renderSettings,
  projectId,
  devApiKey, 
  runtimeUrl
}: {
  children: any;
  dictionary: Dictionary,
  initialTranslations: Translations;
  locale: string;
  defaultLocale: string;
  translationRequired: boolean;
  regionalTranslationRequired: boolean;
  requiredPrefix: string | undefined;
  renderSettings: {
    method: RenderMethod;
    timeout?: number;
  };
  projectId?: string;
  devApiKey?: string;
  runtimeUrl?: string;
}) {

  const [translations, setTranslations] = useState<Record<string, any> | null>(null);

  useLayoutEffect(() => {
    (async () => {
      const awaitedTranslations: TranslationsObject = {};
      await Promise.all(
        Object.entries(initialTranslations).map(async ([id, translationEntry]) => {
          if (isTranslationPromise(translationEntry)) {
            try {
              const translation = await translationEntry.promise;
              awaitedTranslations[id] = { [translationEntry.hash]: translation };
            } catch (error) {
              awaitedTranslations[id] = {
                error: "An error occurred.",
                code: 500
              };
            }
          }
        })
      );
      setTranslations((prev) => ({ ...prev, ...awaitedTranslations }));
    })();
    setTranslations((prev) => ({ ...initialTranslations, ...prev }));
  }, []);
  
  
  // For dictionaries
  const translate = useCallback(
    (id: string, options: Record<string, any> = {}) => {
      
      if (requiredPrefix && !id?.startsWith(requiredPrefix))
        throw new Error(createRequiredPrefixError(id, requiredPrefix))
      
      const dictionaryEntry = dictionary[id];
      if (
        dictionaryEntry === undefined || dictionaryEntry === null || 
        (typeof dictionaryEntry === 'object' && !Array.isArray(dictionaryEntry))) 
      {
        console.warn(createNoEntryWarning(id))
        return undefined;
      };

      // Get the entry from the dictionary
      let { entry, metadata } = extractEntryMetadata(dictionaryEntry);

      // Initialize and populate variables and variables' metadata
      let variables = options;
      let variablesOptions = metadata?.variablesOptions;

      // ----- RENDER METHODS ----- //
      const renderString = (content: any) => {
        return renderContentToString(
          content,
          [locale, defaultLocale],
          variables,
          variablesOptions
        );
      };

      const renderDefaultLocale = () => {
        if (typeof entry === 'string') return renderString(entry);
        return renderDefaultChildren({
          children: entry,
          variables,
          variablesOptions,
          defaultLocale, renderVariable
        });
      };

      const renderLoadingSkeleton = () => {
        if (typeof entry === 'string') return renderString(entry);
        return renderSkeleton({
          children: entry,
          variables,
          defaultLocale,
          renderVariable
        });
      }

      const renderLoadingDefault = () => {
        if (regionalTranslationRequired) return renderDefaultLocale();
        return renderLoadingSkeleton();
      }

      // render translated content
      const renderTranslation = (target: any) => {
        if (typeof entry === 'string') return renderString(target);
        return renderTranslatedChildren({
          source: entry,
          target,
          variables,
          variablesOptions,
          locales: [locale, defaultLocale],
          renderVariable
        });
      };
      
      
      // ----- RENDER BEHAVIOR ----- //
      
      // No tx required, so render default locale
      if (!translationRequired) return renderDefaultLocale();

      // error behavior -> fallback to default language
      if (translations?.[id]?.error) {
        return renderDefaultLocale();
      }

      // loading behavior
      if (!translations || translations[id]?.promise || !translations[id]?.[metadata?.hash]) {
        
        if (renderSettings.method === 'skeleton') {
          return renderLoadingSkeleton();
        }
        if (renderSettings.method === 'replace') {
          return renderDefaultLocale();
        }
        if (renderSettings.method === 'subtle') {
          return renderDefaultLocale();
        }
        // default behavior
        return renderLoadingDefault();
      }

      const translation = translations?.[id];
      return renderTranslation(translation?.[metadata?.hash]);
    },
    [dictionary, translations]
  );

  // For <T> components
  const { translateChildren, translateContent } = useDynamicTranslation({
    targetLocale: locale, projectId, devApiKey, runtimeUrl, setTranslations, defaultLocale
  }); 

  return (
    <GTContext.Provider
      value={{
        translate, translateChildren, translateContent,
        locale,
        defaultLocale,
        translations,
        translationRequired,
        regionalTranslationRequired,
        renderSettings,
      }}
    >
      {translations && children}
    </GTContext.Provider>
  );
}
