import { DictionaryEntry, mergeDictionaries } from 'gt-react/internal';
import { isValidElement } from 'react';
import getI18NConfig from '../config-dir/getI18NConfig';
import { getLocale } from '../request/getLocale';
import getDictionary, { getDictionaryEntry } from '../dictionary/getDictionary';
import { Dictionary, TranslationsObject } from 'gt-react/internal';
import { createDictionarySubsetError } from '../errors/createErrors';
import ClientProvider from './ClientProviderWrapper';
import { GTProviderProps } from '../utils/types';

export default async function GTProvider({
  children,
  id: prefixId,
  locale: _locale,
}: GTProviderProps) {
  // ---------- SETUP ---------- //
  const I18NConfig = getI18NConfig();
  const locale = _locale || (await getLocale());
  const defaultLocale = I18NConfig.getDefaultLocale();
  const [translationRequired, dialectTranslationRequired] =
    I18NConfig.requiresTranslation(locale);

  // load dictionary
  const dictionaryTranslations =
    (await I18NConfig.getDictionaryTranslations(locale)) || {};

  // ----- FETCH TRANSLATIONS FROM CACHE ----- //

  const cachedTranslationsPromise: Promise<TranslationsObject> =
    translationRequired
      ? I18NConfig.getCachedTranslations(locale)
      : ({} as any);

  // ---------- PROCESS DICTIONARY ---------- //
  // (While waiting for cache...)

  // Get dictionary subset
  let dictionary: Dictionary | DictionaryEntry =
    (prefixId ? getDictionaryEntry(prefixId) : await getDictionary()) || {};

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

  // Insert prefix into dictionary
  if (prefixId) {
    const prefixPath = prefixId.split('.').reverse();
    dictionary = prefixPath.reduce<Dictionary>((acc, prefix) => {
      return { [prefix]: acc };
    }, dictionary as Dictionary);
  }

  // Merge dictionary with dictionary translations
  dictionary = mergeDictionaries(dictionary, dictionaryTranslations);

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
      gtServicesEnabled={
        process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED === 'true'
      }
      {...I18NConfig.getClientSideConfig()}
    >
      {children}
    </ClientProvider>
  );
}
