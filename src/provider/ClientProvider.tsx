'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import {
  GTContext, useDynamicTranslation
} from 'gt-react/client';
import { renderDefaultChildren, renderTranslatedChildren } from 'gt-react/internal';
import { extractEntryMetadata } from 'gt-react/internal';
import { renderContentToString } from 'generaltranslation';
import renderVariable from '../server/rendering/renderVariable';
import { Dictionary } from 'gt-react/dist/types/types';
import { createNoEntryWarning, createRequiredPrefixError } from '../errors/createErrors';

// meant to be used inside the server-side <GTProvider>
export default function ClientProvider({
  children,
  dictionary,
  initialTranslations,
  locale,
  defaultLocale,
  translationRequired,
  requiredPrefix,
  renderSettings,
  projectId,
  devApiKey, 
  baseUrl,
  env
}: {
  children: any;
  dictionary: Dictionary,
  initialTranslations: Record<string, any>;
  locale: string;
  defaultLocale: string;
  translationRequired: boolean;
  requiredPrefix: string | undefined;
  renderSettings: {
    method: 'skeleton' | 'replace' | 'hang' | 'subtle';
    timeout: number | null;
  };
  projectId?: string;
  devApiKey?: string;
  baseUrl?: string;
  env?: string;
}) {

  const [translations, setTranslations] = useState<Record<string, any> | null>(null);

  useLayoutEffect(() => {
    (async () => {
      const awaitedTranslations: Record<string, any> = {};
      Promise.all(
        Object.entries(initialTranslations).map(async ([id, obj]) => {
          if (obj?.promise) {
            try {
              const translation = await obj.promise;
              awaitedTranslations[id] = { [obj.hash]: translation };
            } catch (error) {
              console.error(error);
              awaitedTranslations[id] = undefined;
            }
          }
        })
      )
      setTranslations((prev) => ({...initialTranslations, ...prev, ...awaitedTranslations }))
    })();
    setTranslations((prev) => ({ ...prev }));
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

      // ----- STRING ENTRIES ----- // 

      if (typeof entry === 'string') {

        const r = (content: any) => {
          return renderContentToString(
            content,
            [locale, defaultLocale],
            variables,
            variablesOptions
          );
        };

        if (!translationRequired) return r(entry);
          
        const translation = translations?.[id];

        return r(
          translation?.[metadata?.hash] || 
          translation?.loadingFallback || 
          entry
        );

      }

      // ----- JSX ENTRIES ----- // 

      const rd = () => {
        return renderDefaultChildren({
          children: entry,
          variables,
          variablesOptions,
          defaultLocale, renderVariable
        });
      };

      // Fallback if there is no translation present
      if (!translationRequired) return rd();
      const translation = translations?.[id];
      if (!translation) return rd();

      const rt = (target: any) => {
        return renderTranslatedChildren({
          source: entry,
          target,
          variables,
          variablesOptions,
          locales: [locale, defaultLocale],
          renderVariable
        });
      };

      if (translation?.promise) {
        translation.errorFallback ||= rd();
        translation.loadingFallback ||= translation.errorFallback;
        // suspense here for hydration reasons
        return (
          <Suspense fallback={translation.loadingFallback}>
            {translation.loadingFallback}
          </Suspense>
        )
      };

      return rt(translation?.[metadata?.hash]);
    },
    [dictionary, translations]
  );

  // For <T> components
  const { translateChildren, translateContent } = useDynamicTranslation({
    projectId, devApiKey, baseUrl, setTranslations, defaultLocale, env
  }); 

  return (
    <GTContext.Provider
      value={{
        translate, translateChildren, translateContent,
        locale,
        defaultLocale,
        translations,
        translationRequired,
        renderSettings
      }}
    >
      {translations && children}
    </GTContext.Provider>
  );
}
