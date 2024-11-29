import React from 'react';
import {
  flattenDictionary,
  extractEntryMetadata,
} from 'gt-react/internal';
import { ReactNode } from 'react';
import getI18NConfig from '../config/getI18NConfig';
import getLocale from '../request/getLocale';
import getMetadata from '../request/getMetadata';
import { splitStringToContent } from 'generaltranslation';
import getDictionary, { getDictionaryEntry } from '../dictionary/getDictionary';
import ClientProvider from './ClientProvider';
import { ClientDictionary, ClientTranslations } from './types';

/**
 * Provides General Translation context to its children, which can then access `useGT`, `useLocale`, and `useDefaultLocale`.
 *
 * @param {React.ReactNode} children - The children components that will use the translation context.
 * @param {string} id - ID of a nested dictionary, so that only a subset of a large dictionary needs to be sent to the client.
 *
 * @returns {JSX.Element} The provider component for General Translation context.
 */
export default async function GTProvider({
  children,
  id,
}: {
  children?: ReactNode;
  id?: string;
}) {
  
  const getID = (suffix: string) => {
    return id ? `${id}.${suffix}` : suffix;
  };

  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const additionalMetadata = await getMetadata();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const renderSettings = I18NConfig.getRenderSettings();
  const translationRequired = I18NConfig.requiresTranslation(locale);
  
  let translationsPromise;
  if (translationRequired) translationsPromise = I18NConfig.getTranslations(locale)
  

  // Flatten dictionaries for processing while waiting for translations
  const dictionaryEntries = flattenDictionary(id ? getDictionaryEntry(id) : getDictionary());

  let dictionary: ClientDictionary = {};
  let translations: ClientTranslations = {};
  
  // i.e. if a translation is required
  let existingTranslations = (translationsPromise) ? await translationsPromise : {};
  
  // Check and standardize flattened dictionary entries before passing them to the client
  await Promise.all(
    Object.entries(dictionaryEntries).map(async ([suffix, dictionaryEntry]) => {

      // ---- POPULATING THE DICTIONARY ---- //

      // Get the entry from the dictionary
      const entryID = getID(suffix);
      let { entry, metadata } = extractEntryMetadata(dictionaryEntry);
      if (typeof entry === 'undefined') return; 

      // If entry is a function, execute it
      if (typeof entry === 'function') {
        entry = entry({});
        metadata = { ...metadata, isFunction: true };
      }

      // Tag the result of entry
      const taggedEntry = I18NConfig.addGTIdentifier(entry, entryID);

      // Set dictionary entry to be passed to the client
      dictionary[entryID] = [taggedEntry, metadata];

      // If no translation is required, return
      if (!translationRequired) return;

      // ---- POPULATING TRANSLATIONS ---- //

      const [entryAsObjects, key] = I18NConfig.serializeAndHash(
        taggedEntry,
        metadata?.context,
        entryID
      );

      // If a translation already exists, add it to the translations
      const translation = existingTranslations?.[entryID];
      if (translation && translation.k === key) {
        return (translations[entryID] = translation);
      }

      // Create a translation if it does not exist! 

      if (typeof taggedEntry === 'string') {
        const translationPromise = I18NConfig.translate({
          content: splitStringToContent(taggedEntry),
          targetLocale: locale,
          options: { id: entryID, hash: key, ...additionalMetadata },
        });
        if (renderSettings.method !== "subtle") 
          return translations[entryID] = {
              t: await translationPromise,
              k: key
          };
        return undefined;
      };

      // Translate React children

      const translationPromise = I18NConfig.translateChildren({
        children: entryAsObjects,
        targetLocale: locale,
        metadata: {
          id: entryID,
          hash: key,
          ...additionalMetadata,
          ...(renderSettings.timeout && { timeout: renderSettings.timeout }),
        },
      });

      let loadingFallback;
      let errorFallback;

      if (renderSettings.method === 'skeleton') {
        loadingFallback = <React.Fragment key={`skeleton_${entryID}`} />;
      }

      return (translations[entryID] = {
        promise: translationPromise,
        k: key,
        loadingFallback,
        errorFallback,
      });
    })
  );

  return (
    <ClientProvider
      dictionary={dictionary}
      translations={{ ...existingTranslations, ...translations }}
      locale={locale}
      defaultLocale={defaultLocale}
      translationRequired={translationRequired}
      requiredPrefix={id}
    >
      {children}
    </ClientProvider>
  );
}
