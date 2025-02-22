import {
  flattenDictionary,
  getEntryAndMetadata,
  DictionaryEntry,
  Entry,
  TranslatedChildren,
} from 'gt-react/internal';
import { isValidElement, ReactNode } from 'react';
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
  id: prefixId,
}: {
  children?: ReactNode;
  id?: string;
}) {
  // ---------- SETUP ---------- //

  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const [translationRequired, dialectTranslationRequired] =
    I18NConfig.requiresTranslation(locale);

  // ----- FETCH TRANSLATIONS FROM CACHE ----- //

  const cachedTranslationsPromise: Promise<TranslationsObject> =
    translationRequired
      ? I18NConfig.getCachedTranslations(locale)
      : ({} as any);

  // ---------- PROCESS DICTIONARY ---------- //
  // (While waiting for cache...)

  // Get dictionary subset
  let dictionary: Dictionary | DictionaryEntry =
    (prefixId ? getDictionaryEntry(prefixId) : getDictionary()) || {};

  // Check provisional dictionary
  if (
    isValidElement(dictionary) ||
    Array.isArray(dictionary) ||
    typeof dictionary !== 'object'
  ) {
    // cannot be a DictionaryEntry, must be a Dictionary
    throw new Error(
      createDictionarySubsetError(prefixId ?? '', '<GTProvider>')
    );
  }

  // Block until cache check resolves
  const translations = await cachedTranslationsPromise;

  return (
    <ClientProvider
      dictionary={dictionary}
      initialTranslations={translations}
      locale={locale}
      locales={I18NConfig.getLocales()}
      defaultLocale={defaultLocale}
      translationRequired={translationRequired}
      dialectTranslationRequired={dialectTranslationRequired}
      {...I18NConfig.getClientSideConfig()}
    >
      {children}
    </ClientProvider>
  );
}
