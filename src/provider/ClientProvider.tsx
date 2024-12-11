'use client';

import {
  Suspense,
  useCallback,
  useState,
} from 'react';
import {
  GTContext, useDynamicTranslation
} from 'gt-react/client';
import { renderDefaultChildren, renderTranslatedChildren } from 'gt-react/internal';
import { addGTIdentifier, extractEntryMetadata } from 'gt-react/internal';
import { renderContentToString } from 'generaltranslation';
import { ClientDictionary, ClientTranslations } from './types';
import renderVariable from '../server/rendering/renderVariable';
import ClientResolver from './ClientResolver';
import { createAdvancedFunctionsError, createNoEntryWarning, createRequiredPrefixError } from '../errors/createErrors';

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
  projectId, devApiKey, 
  baseUrl, 
  ...metadata
}: {
  children: any;
  dictionary: ClientDictionary;
  initialTranslations: Record<string, any>;
  locale: string;
  defaultLocale: string;
  translationRequired: boolean;
  requiredPrefix: string | undefined;
  renderSettings: {
    method: 'skeleton' | 'replace' | 'hang' | 'subtle';
    timeout: number | null;
  };
  projectId: string;
  devApiKey: string;
  baseUrl: string;
}) {

  const [translations, setTranslations] = useState(initialTranslations);
  
  // For dictionaries
  const translate = useCallback(
    (id: string, options: Record<string, any> = {}, f?: Function) => {
      
      if (requiredPrefix && !id?.startsWith(requiredPrefix))
        throw new Error(createRequiredPrefixError(id, requiredPrefix))
      
      // Get the entry from the dictionary
      let { entry, metadata } = extractEntryMetadata(dictionary[id]);

      if (typeof entry === 'undefined') {
        console.warn(createNoEntryWarning(id));
        return undefined;
      }

      // Handle functional entries
      if (metadata?.isFunction) {
        if (typeof f === 'function') {
          entry = addGTIdentifier(f(options));
        } else {
          throw new Error(
            createAdvancedFunctionsError(id, options)
          );
        }
      };

      // Initialize and populate variables and variables' metadata
      let variables = options;
      let variablesOptions: Record<string, Intl.NumberFormatOptions | Intl.DateTimeFormatOptions> | undefined;
      if (metadata?.variablesOptions)
        variablesOptions = {
          ...(variablesOptions || {}),
          ...metadata.variablesOptions,
        };
      if (options.variablesOptions)
        variablesOptions = {
          ...(variablesOptions || {}),
          ...options.variablesOptions,
      };

      // Handle string and content entries, if and !if translation required
      if (typeof entry === 'string') {
        const content = translationRequired ? (translations[id]?.t || entry) : entry;
        return renderContentToString(
          content,
          [locale, defaultLocale],
          variables,
          variablesOptions
        );
      }

      // Fallback if there is no translation present
      if (!translationRequired || !translations[id]) {
        return renderDefaultChildren({
          children: entry,
          variables,
          variablesOptions,
          defaultLocale, renderVariable
        });
      }

      const renderTranslation = (translationEntry: any) => {
        return renderTranslatedChildren({
          source: entry,
          target: translationEntry,
          variables,
          variablesOptions,
          locales: [locale, defaultLocale],
          renderVariable
        });
      };

      const translation = translations[id];

      if (translation.promise) { // i.e. no translation.t
        if (!translation.errorFallback) {
          translation.errorFallback = renderDefaultChildren({
            children: entry,
            variables,
            variablesOptions,
            defaultLocale,
            renderVariable
          });
        }
        if (!translation.loadingFallback) {
          translation.loadingFallback = translation.errorFallback;
        }
        return (
          <ClientResolver
            promise={translation.promise}
            renderTranslation={renderTranslation}
            errorFallback={translation.errorFallback}
            loadingFallback={translation.loadingFallback}
          />
        );
      }

      return renderTranslation(translation.t);
    },
    [dictionary, translations]
  );

  const { translateChildren, translateContent } = useDynamicTranslation({
    projectId, devApiKey, baseUrl, setTranslations, defaultLocale
  })

  return (
    <GTContext.Provider
      value={{
        translate, translateChildren, translateContent,
        locale,
        defaultLocale,
        translations,
        translationRequired
      }}
    >
      {children}
    </GTContext.Provider>
  );
}
