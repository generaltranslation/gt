import {
  flattenDictionary,
  extractEntryMetadata,
  DictionaryEntry,
  Entry,
  TranslatedChildren,
} from 'gt-react/internal';
import { ReactNode } from 'react';
import getI18NConfig from '../config/getI18NConfig';
import getLocale from '../request/getLocale';
import getMetadata from '../request/getMetadata';
import { isSameLanguage, splitStringToContent } from 'generaltranslation';
import getDictionary, { getDictionaryEntry } from '../dictionary/getDictionary';
import ClientProvider from './ClientProvider';
import { Dictionary, TranslationsObject } from 'gt-react/internal';
import { createDictionarySubsetError } from '../errors/createErrors';
import { FlattenedTaggedDictionary } from '../types/types'; 

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
  
  // Set up
  const getId = (suffix: string) => { return id ? `${id}.${suffix}` : suffix };
  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const additionalMetadata = await getMetadata();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const translationRequired = I18NConfig.requiresTranslation(locale);
  const dialectTranslationRequired = translationRequired && isSameLanguage(locale, defaultLocale);

  // Start fetching translations from cache
  const translationsPromise = translationRequired && I18NConfig.getCachedTranslations(locale);
  
  // Flatten dictionaries for processing while waiting for translations
  const dictionarySubset: Dictionary | DictionaryEntry = (id ? getDictionaryEntry(id) : getDictionary()) || {};
  if (typeof dictionarySubset !== 'object' || Array.isArray(dictionarySubset)) // cannot be a DictionaryEntry, must be a Dictionary
    throw new Error(createDictionarySubsetError(id ?? '', "<GTProvider>"));
  const flattenedDictionarySubset = flattenDictionary(dictionarySubset as Dictionary);

  // Block until cache check resolves
  const translations: TranslationsObject = (translationsPromise) ? await translationsPromise : {};
  const dictionary: FlattenedTaggedDictionary = {};
  const promises: Record<string, Promise<TranslatedChildren>> = {};
  
  // ---- TRANSLATE DICTIONARY STRINGS ---- //
  /**
   * Strings Entries: hang until translation resolves
   * JSX Entries: pass directly to client (translation will be performed on demand)
   * 
   * We will also be populating the dictionary
   */

  await Promise.all(
    Object.entries(flattenedDictionarySubset ?? {}).map(async ([suffix, dictionaryEntry]) => {

      // Get the entry from the dictionary
      if (!dictionaryEntry) return; // dictionary entries cannot be falsey
      const entryId = getId(suffix);


      let { entry, metadata } = extractEntryMetadata(dictionaryEntry);
      if (!entry) return; // dictionary entries cannot be falsey

      // Only translate strings
      if (typeof entry !== 'string') {
        // Populating the dictionary that we will pass to the client
        const taggedChildren = I18NConfig.addGTIdentifier(entry);
        const [childrenAsObjects, hash] = I18NConfig.serializeAndHashChildren(entry, metadata?.context);
        dictionary[entryId] = [taggedChildren as Entry, { ...metadata, hash }];

        // if no tx required, we are done
        if (!translationRequired) return;

        // Check if the translation already exists
        const translationEntry = translations?.[entryId]?.[hash];

        // If the translation already exists, then do not translate on demand
        // or runtime translation disabled
        if (translationEntry) return;

        // Perform on-demand translation
        const translationPromise = I18NConfig.translateChildren({
          source: childrenAsObjects,
          targetLocale: locale,
          metadata: {
            ...metadata,
            id: entryId,
            hash
          },
        });

        // record translations as loading and record the promises to use on client-side
        translations[entryId] = { [hash]: { state: 'loading' } };
        promises[entryId] = translationPromise;
        return;
      };

      // Get serialize and hash string entry
      const contentArray = splitStringToContent(entry);
      const hash = metadata?.hash || I18NConfig.hashContent(contentArray, metadata?.context);

      // Add to client dictionary
      dictionary[entryId] = [entry, { ...metadata, hash }];

      // if no tx required, we are done
      if (!translationRequired) return;

      // Check if the translation already exists
      const translationEntry = translations?.[entryId]?.[hash];

      // If the translation already exists, then do not translate on demand
      if (translationEntry) return;
      
      // Perform on-demand translation
      try {
        // wait for the translation to resolve, we cannot pass our translations to
        // the client until all string translations are resolved
        const translation = await I18NConfig.translateContent({
          source: contentArray,
          targetLocale: locale,
          options: {
            id: entryId,
            hash,
            ...additionalMetadata,
            ...{ context: metadata?.context },
          },
        });

        // overwriting any old translations, this is most recent on demand, so should be most accurate
        translations[entryId] = { [hash]: { state: 'success', target: translation } };
      } catch (error) {
        console.error(error)
      }
    })
  );

  return (
    <ClientProvider
      dictionary={dictionary}
      initialTranslations={translations}
      translationPromises={promises}
      locale={locale}
      locales={I18NConfig.getLocales()}
      defaultLocale={defaultLocale}
      translationRequired={translationRequired}
      dialectTranslationRequired={dialectTranslationRequired}
      requiredPrefix={id}
      renderSettings={I18NConfig.getRenderSettings()}
      {...I18NConfig.getClientSideConfig()}
    >
      {children}
    </ClientProvider>
  );
}
