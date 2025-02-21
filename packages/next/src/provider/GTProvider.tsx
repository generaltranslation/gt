import {
  flattenDictionary,
  getEntryAndMetadata,
  DictionaryEntry,
  Entry,
  TranslatedChildren,
  FlattenedTaggedDictionary,
  GTTranslationError,
  TranslationError,
  writeChildrenAsObjects,
  TranslationSuccess,
  TranslationLoading,
} from 'gt-react/internal';
import { ReactNode } from 'react';
import getI18NConfig from '../config-dir/getI18NConfig';
import getLocale from '../request/getLocale';
import { isSameLanguage, splitStringToContent } from 'generaltranslation';
import getDictionary, { getDictionaryEntry } from '../dictionary/getDictionary';
import { Dictionary, TranslationsObject } from 'gt-react/internal';
import { createDictionarySubsetError } from '../errors/createErrors';
import ClientProvider from './ClientProviderWrapper';
import { hashJsxChildren } from 'generaltranslation/id';

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
  // ---------- SETUP ---------- //

  // Calculate the ID with prefix
  const getId = (suffix: string) => {
    return id ? `${id}.${suffix}` : suffix;
  };

  // Setup
  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const translationRequired = I18NConfig.requiresTranslation(locale);
  const dialectTranslationRequired =
    translationRequired && isSameLanguage(locale, defaultLocale);
  const serverRuntimeTranslationEnabled =
    I18NConfig.isServerRuntimeTranslationEnabled() &&
    process.env.NODE_ENV === 'development';

  // Start fetching translations from cache
  const translationsPromise =
    translationRequired && I18NConfig.getCachedTranslations(locale);

  // ---------- FORMAT DICTIONARIES ---------- //
  // (While waiting for cache...)

  // Get dictionary subset
  const dictionarySubset: Dictionary | DictionaryEntry =
    (id ? getDictionaryEntry(id) : getDictionary()) || {};
  if (typeof dictionarySubset !== 'object' || Array.isArray(dictionarySubset)) {
    // cannot be a DictionaryEntry, must be a Dictionary
    throw new Error(createDictionarySubsetError(id ?? '', '<GTProvider>'));
  }

  // Flatten dictionaries for processing while waiting for translations
  const flattenedDictionarySubset = flattenDictionary(
    dictionarySubset as Dictionary
  );

  // ---------- POPULATE DICTIONARY ---------- //
  // (While waiting for cache...)

  const dictionary: FlattenedTaggedDictionary = {};
  const processedDictionary: Record<string, any> = {};

  Object.entries(flattenedDictionarySubset ?? {}).map(
    ([suffix, dictionaryEntry]) => {
      // ----- SETUP ----- //

      // Reject bad dictionary entries
      if (!dictionaryEntry) return;

      // Get the entry from the dictionary
      const entryId = getId(suffix);
      let { entry, metadata } = getEntryAndMetadata(dictionaryEntry);

      // ---- ADD TO DICTIONARY ---- //

      // Process input
      let source, type;
      if (typeof entry === 'string') {
        type = 'content';
        source = splitStringToContent(entry);
      } else {
        type = 'jsx';
        const taggedChildren = I18NConfig.addGTIdentifier(entry); // Tagging has to be done serverside for streaming purposes (fragments)
        source = writeChildrenAsObjects(taggedChildren);
        entry = taggedChildren;
        console.log(taggedChildren);
      }

      // Get identifier
      // TODO: is it possible to perform this on the client side?
      const key = hashJsxChildren({
        source,
        ...(metadata?.context && { context: metadata.context }),
        id: entryId,
      });

      // Add to client dictionary
      dictionary[entryId] = [entry, { ...metadata, hash: key }];

      // For server runtime translation
      if (serverRuntimeTranslationEnabled && translationRequired) {
        processedDictionary[key] = {
          type,
          source,
          targetLocale: locale,
          options: {
            id: entryId,
            hash: key,
            ...{ context: metadata?.context },
          },
        };
      }
    }
  );

  // ---------- CHECK CACHE FOR TRANSLATIONS ---------- //

  // Block until cache check resolves
  const translations: TranslationsObject = translationsPromise
    ? await translationsPromise
    : {};

  // ---------- TRANSLATE DICTIONARY ON DEMAND ---------- //

  // Record for passing unresolved translations to the client
  const promises: Record<string, Promise<TranslatedChildren>> = {};

  if (serverRuntimeTranslationEnabled && translationRequired) {
    await Promise.all(
      Object.entries(processedDictionary).map(
        async ([key, { type, ...data }]) => {
          // Check if translation exists
          const translationEntry = translations?.[key];
          if (translationEntry) {
            return;
          }

          // Translation result handling
          let result:
            | TranslationSuccess
            | TranslationError
            | TranslationLoading;
          try {
            if (type === 'content') {
              // Block until translation resolves
              result = {
                state: 'success',
                target: await I18NConfig.translateContent(data),
              };
            } else {
              // Record translation promise to pass to client for streaming
              promises[key] = I18NConfig.translateChildren(data).then(
                (result) => {
                  // Add to translations locally
                  // TODO: is this necessary?
                  translations[key] = {
                    state: 'success',
                    target: result,
                  };
                  return result;
                }
              );
              // Mark translation as loading
              result = { state: 'loading' };
            }
          } catch (error) {
            // Parse error
            if (error instanceof GTTranslationError) {
              result = error.toTranslationError();
            } else {
              result = { state: 'error', error: 'An error occured', code: 500 };
            }
          }
          translations[key] = result;
        }
      )
    );
  }

  // await Promise.all(
  //   Object.entries(flattenedDictionarySubset ?? {}).map(
  //     async ([suffix, dictionaryEntry]) => {
  //       // reject bad dictionary entries (we handle empty strings later)
  //       if (!dictionaryEntry && dictionaryEntry !== '') return;

  //       // Get the entry from the dictionary
  //       const entryId = getId(suffix);
  //       let { entry, metadata } = getEntryAndMetadata(dictionaryEntry);

  //       // ----- JSX ----- //
  //       if (typeof entry !== 'string') {
  //         // ----- TRANSLATE JSX ON DEMAND ----- //

  //         // dev only (with api key) skip if:
  //         if (
  //           !translationRequired || // no translation required
  //           !serverRuntimeTranslationEnabled // dev runtime translation disabled
  //         ) {
  //           return;
  //         }

  //         // get tx entry and key
  //         const translationEntry = translations?.[key];

  //         // skip if translation already exists
  //         if (translationEntry) {
  //           return;
  //         }

  //         // Perform on-demand translation
  //         translations[key] = { state: 'loading' };
  //         const translationPromise = I18NConfig.translateChildren({
  //           source: childrenAsObjects,
  //           targetLocale: locale,
  //           metadata: {
  //             ...metadata,
  //             id: entryId,
  //             hash: key,
  //           },
  //         })
  //           .then((result) => {
  //             translations[key] = {
  //               state: 'success',
  //               target: result,
  //             };
  //             return result;
  //           })
  //           .catch((error) => {
  //             if (error instanceof GTTranslationError) {
  //               error = error.toTranslationError();
  //             } else {
  //               error = {
  //                 state: 'error',
  //                 error: 'An error occured',
  //                 code: 500,
  //               };
  //             }
  //             return error;
  //           });

  //         // record translations as loading and record the promises to use on client-side
  //         promises[key] = translationPromise;
  //         return;
  //       }
  //       // ----- TRANSLATE STRINGS ON DEMAND ----- //

  //       // dev only (with api key) skip if:
  //       if (
  //         !translationRequired || // no translation required
  //         !serverRuntimeTranslationEnabled // dev runtime translation disabled
  //       ) {
  //         return;
  //       }

  //       // get tx entry and key
  //       const translationEntry = translations?.[key];

  //       // skip if translation already exists
  //       if (translationEntry) {
  //         return;
  //       }

  //       // Reject empty strings
  //       if (!entry.length) {
  //         translations[key] = {
  //           state: 'error',
  //           error: 'Empty strings are not allowed for translation.',
  //           code: 400,
  //         };
  //         return;
  //       }

  //       // Perform on-demand translation
  //       try {
  //         // wait for the translation to resolve, we cannot pass our translations to
  //         // the client until all string translations are resolved
  //         const translation = await I18NConfig.translateContent({
  //           source: content,
  //           targetLocale: locale,
  //           options: {
  //             id: entryId,
  //             hash: key,
  //             ...{ context: metadata?.context },
  //           },
  //         });

  //         // overwriting any old translations, this is most recent on demand, so should be most accurate
  //         translations[key] = {
  //           state: 'success',
  //           target: translation,
  //         };
  //       } catch (error) {
  //         console.error(error);
  //         // set all promise ids to error in translations
  //         let result;
  //         if (error instanceof GTTranslationError) {
  //           result = error.toTranslationError();
  //         } else {
  //           result = { state: 'error', error: 'An error occured', code: 500 };
  //         }
  //         translations[key] = result as TranslationError;
  //       }
  //     }
  //   )
  // );

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
