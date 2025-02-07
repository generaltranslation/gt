import {
  flattenDictionary,
  extractEntryMetadata,
  DictionaryEntry,
  Entry,
  TranslatedChildren,
  isEmptyReactFragment,
  FlattenedTaggedDictionary,
  GTTranslationError,
} from 'gt-react/internal';
import { ReactNode } from 'react';
import getI18NConfig from '../config/getI18NConfig';
import getLocale from '../request/getLocale';
import getMetadata from '../request/getMetadata';
import { isSameLanguage, splitStringToContent } from 'generaltranslation';
import getDictionary, { getDictionaryEntry } from '../dictionary/getDictionary';
import { Dictionary, TranslationsObject } from 'gt-react/internal';
import { createDictionarySubsetError } from '../errors/createErrors';
import ClientProvider from './ClientProviderWrapper';

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
  const getId = (suffix: string) => {
    return id ? `${id}.${suffix}` : suffix;
  };
  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const additionalMetadata = await getMetadata();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const translationRequired = I18NConfig.requiresTranslation(locale);
  const dialectTranslationRequired =
    translationRequired && isSameLanguage(locale, defaultLocale);
  const runtimeTranslationEnabled = I18NConfig.isRuntimeTranslationEnabled(); // runtime translation enabled in dev

  // Start fetching translations from cache
  const translationsPromise =
    translationRequired && I18NConfig.getCachedTranslations(locale);

  // Flatten dictionaries for processing while waiting for translations
  const dictionarySubset: Dictionary | DictionaryEntry =
    (id ? getDictionaryEntry(id) : getDictionary()) || {};
  if (typeof dictionarySubset !== 'object' || Array.isArray(dictionarySubset))
    // cannot be a DictionaryEntry, must be a Dictionary
    throw new Error(createDictionarySubsetError(id ?? '', '<GTProvider>'));
  const flattenedDictionarySubset = flattenDictionary(
    dictionarySubset as Dictionary
  );

  // Block until cache check resolves
  const translations: TranslationsObject = translationsPromise
    ? await translationsPromise
    : {};
  const dictionary: FlattenedTaggedDictionary = {};
  const promises: Record<string, Promise<TranslatedChildren>> = {};

  // ---- POPULATE DICTONARY + TRANSLATE DICTIONARY ON DEMAND ---- //
  /**
   * Populate dictionaries
   *
   * On demand tx (dev only):
   * Strings Entries: hang until translation resolves
   * JSX Entries: pass directly to client (translation will be performed on demand)
   *
   */

  await Promise.all(
    Object.entries(flattenedDictionarySubset ?? {}).map(
      async ([suffix, dictionaryEntry]) => {
        // reject bad dictionary entries (we handle empty strings later)
        if (!dictionaryEntry && dictionaryEntry !== '') return;

        // Get the entry from the dictionary
        const entryId = getId(suffix);
        let { entry, metadata } = extractEntryMetadata(dictionaryEntry);

        // ---- POPULATE DICTIONARY JSX ---- //
        if (typeof entry !== 'string') {
          // Populating the dictionary that we will pass to the client
          const taggedChildren = I18NConfig.addGTIdentifier(entry);
          const [childrenAsObjects, hash] = I18NConfig.serializeAndHashChildren(
            taggedChildren,
            metadata?.context
          );
          dictionary[entryId] = [
            taggedChildren as Entry,
            { ...metadata, hash },
          ];

          // ----- TRANSLATE JSX ON DEMAND ----- //

          // dev only (with api key) skip if:
          if (
            !translationRequired || // no translation required
            !runtimeTranslationEnabled // dev runtime translation disabled
          ) {
            return;
          }

          // Issue: every dev cache request with id is a cache miss
          // because cache now stores ids over hashes, when we come
          // across a tx from the cache w/o a hash (so it has an id instead)
          // we will always trigger an on-demand translation because
          // we cannot verify that the content has been changed.
          // for now, this will only be an issue in dev, and for
          // tx() which do translation on-demand.
          // It shouldn't result in extra token charge because we
          // will just grab the translation from the database instead,
          // but it is definitely causes slower perfomance in dev and
          // any other on-demand translations where id has replaced hash

          // get tx entry
          const key = process.env.NODE_ENV === 'development' ? hash : entryId;
          const translationEntry = translations?.[key];

          // skip if:
          if (
            translationEntry && // already have translation
            (translationEntry.state !== 'success' || // not a success
              translationEntry.hash === hash) // hash matches
          ) {
            return;
          }

          // Reject empty fragments
          if (isEmptyReactFragment(entry)) {
            translations[key] = {
              state: 'error',
              error: 'Empty fragments are not allowed for translation.',
              code: 400,
            };
            return;
          }

          // Perform on-demand translation
          translations[key] = { state: 'loading' };
          const translationPromise = I18NConfig.translateChildren({
            source: childrenAsObjects,
            targetLocale: locale,
            metadata: {
              ...metadata,
              id: entryId,
              hash,
            },
          })
            .then((result) => {
              translations[key] = {
                state: 'success',
                target: result,
              };
              return result;
            })
            .catch((error) => {
              if (error instanceof GTTranslationError) {
                error = error.toTranslationError();
              } else {
                error = {
                  state: 'error',
                  error: 'An error occured',
                  code: 500,
                };
              }
              return error;
            });

          // record translations as loading and record the promises to use on client-side
          promises[key] = translationPromise;
          return;
        }

        // ---- POPULATE DICTIONARY STRINGS ---- //

        // Get serialize and hash string entry
        const content = splitStringToContent(entry);
        const hash =
          metadata?.hash || I18NConfig.hashContent(content, metadata?.context);

        // Add to client dictionary
        dictionary[entryId] = [entry, { ...metadata, hash }];

        // ----- TRANSLATE STRINGS ON DEMAND ----- //

        // dev only (with api key) skip if:
        if (
          !translationRequired || // no translation required
          !runtimeTranslationEnabled // dev runtime translation disabled
        ) {
          return;
        }

        // If the translation already exists, then do not translate on demand
        const key = process.env.NODE_ENV === 'development' ? hash : entryId;
        const translationEntry = translations?.[key];
        if (
          translationEntry && // already have translation
          (translationEntry.state !== 'success' || // not a success
            translationEntry.hash === hash) // hash matches
        ) {
          return;
        }

        // Reject empty strings
        if (!entry.length) {
          translations[key] = {
            state: 'error',
            error: 'Empty strings are not allowed for translation.',
            code: 400,
          };
          return;
        }

        // Perform on-demand translation
        try {
          // wait for the translation to resolve, we cannot pass our translations to
          // the client until all string translations are resolved
          const translation = await I18NConfig.translateContent({
            source: content,
            targetLocale: locale,
            options: {
              id: entryId,
              hash,
              ...additionalMetadata,
              ...{ context: metadata?.context },
            },
          });

          // overwriting any old translations, this is most recent on demand, so should be most accurate
          translations[key] = {
            state: 'success',
            target: translation,
          };
        } catch (error) {
          console.error(error);
        }
      }
    )
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
      translationEnabled={I18NConfig.translationEnabled()}
      runtimeTranslationEnabled={runtimeTranslationEnabled}
      {...I18NConfig.getClientSideConfig()}
    >
      {children}
    </ClientProvider>
  );
}
