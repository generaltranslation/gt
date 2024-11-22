'use client';

import {
  useCallback,
} from 'react';
import {
  GTContext,
} from 'gt-react/client';
import { renderDefaultChildren, renderTranslatedChildren } from 'gt-react/internal';
import { addGTIdentifier, extractEntryMetadata } from 'gt-react/internal';
import { renderContentToString } from 'generaltranslation';
import ClientResolver from './ClientResolver';
import { ClientDictionary, ClientTranslations } from './types';
import renderVariable from '../server/rendering/renderVariable';

// meant to be used inside the server-side <GTProvider>
export default function ClientProvider({
  children,
  dictionary,
  translations,
  locale,
  defaultLocale,
  translationRequired,
}: {
  children: any;
  dictionary: ClientDictionary;
  translations: ClientTranslations;
  locale: string;
  defaultLocale: string;
  translationRequired: boolean;
}) {

  // For dictionaries
  const translate = useCallback(
    (id: string, options: Record<string, any> = {}, f?: Function) => {
      
      // Get the entry from the dictionary
      let { entry, metadata } = extractEntryMetadata(dictionary[id]);
      if (typeof entry === 'undefined') {
        console.warn(`Dictionary entry with id "${id}" is null or undefined`);
        return undefined;
      }

      // Handle functional entries
      if (metadata?.isFunction) {
        if (typeof f === 'function') {
          entry = addGTIdentifier(f(options));
        } else {
          throw new Error(
            `You're trying to call a function in the server dictionary on the client-side, but functions can't be passed directly from server to client. ` +
              `Try including the function you want to call as a parameter in t(), like t("${id}", ${
                options ? JSON.stringify(options) : 'undefined'
              }, MyFunction)`
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
        const content = translationRequired ? (translations[id] || entry) : entry;
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

      if (translation.promise) {
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

      return renderTranslation(translation);
    },
    [dictionary, translations]
  );

  return (
    <GTContext.Provider
      value={{
        translate,
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
