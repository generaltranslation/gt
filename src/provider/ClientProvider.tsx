'use client';

import React, {
  useCallback,
  useLayoutEffect,
  useEffect,
  useState,
  useRef,
  Suspense,
} from 'react';
import {
  _GTContext,
  _renderDefaultChildren,
  _renderTranslatedChildren,
} from 'gt-react/client';
import { addGTIdentifier, extractEntryMetadata } from 'gt-react/internal';
import { renderContentToString } from 'generaltranslation';
import ClientResolver from './ClientResolver';

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
  dictionary: Record<string, any>;
  translations: Record<string, any>;
  locale: string;
  defaultLocale: string;
  translationRequired: boolean;
}) {
  // For dictionaries
  const translate = useCallback(
    (id: string, options: Record<string, any> = {}, f?: Function) => {
      let { entry, metadata } = extractEntryMetadata(dictionary[id]);

      if (!entry) {
        console.warn(`Dictionary entry with id "${id}" is null or undefined`);
        return undefined;
      }

      if (metadata && metadata.isFunction) {
        if (typeof f !== 'function') {
          throw new Error(
            `You're trying to call a function in the server dictionary on the client-side, but functions can't be passed directly from server to client. ` +
              `Try including the function you want to call as a parameter in t(), like t("${id}", ${
                options ? JSON.stringify(options) : 'undefined'
              }, MyFunction)`
          );
        }
        entry = addGTIdentifier(f(options));
      }

      let variables = options;
      let variablesOptions: Record<string, any> | undefined;
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

      if (typeof entry === 'string') {
        const translation = translations[id]?.t || entry;
        return renderContentToString(
          translationRequired ? translation : entry,
          [locale, defaultLocale],
          variables,
          variablesOptions
        );
      }

      if (!translationRequired || !translations[id]) {
        return _renderDefaultChildren({
          children: entry,
          variables,
          variablesOptions,
          defaultLocale,
        });
      }

      const renderTranslation = (translationEntry: any) => {
        return _renderTranslatedChildren({
          source: entry,
          target: translationEntry,
          variables,
          variablesOptions,
          locales: [locale, defaultLocale],
        });
      };

      const translation = translations[id];

      if (translation.promise) {
        if (!translation.errorFallback) {
          translation.errorFallback = _renderDefaultChildren({
            children: entry,
            variables,
            variablesOptions,
            defaultLocale,
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

  return (
    <_GTContext.Provider
      value={{
        translate,
        locale,
        defaultLocale,
        translations,
      }}
    >
      {children}
    </_GTContext.Provider>
  );
}
