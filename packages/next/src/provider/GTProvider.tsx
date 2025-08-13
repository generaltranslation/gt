import {
  DictionaryEntry,
  mergeDictionaries,
  TranslationsStatus,
} from 'gt-react/internal';
import { isValidElement } from 'react';
import getI18NConfig from '../config-dir/getI18NConfig';
import { getLocale } from '../request/getLocale';
import getDictionary, { getDictionaryEntry } from '../dictionary/getDictionary';
import { Dictionary, Translations } from 'gt-react/internal';
import { createDictionarySubsetError } from '../errors/createErrors';
import ClientProvider from './ClientProviderWrapper';
import { GTProviderProps } from '../utils/types';
import { getRegion } from '../request/getRegion';

/*
Note: In normal circumstances, both _locale and _region would be at risk of causing hydration errors.
They would be advised against as parameters of GTProvider.
However:
- _region is used only on the client side, and is accessed on the server purely downstream of being set as a cookie by the client
- A disparity between _locale and the server side locale will cause the window to reload in order to set _locale as the server side locale too
*/

export default async function GTProvider({
  children,
  id: prefixId,
  locale: _locale,
  region: _region,
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

  const cachedTranslationsPromise: Promise<Translations> = translationRequired
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
  const translationsStatus: TranslationsStatus = translationRequired
    ? I18NConfig.getCachedTranslationsStatus(locale)
    : ({} as any);

  return (
    <ClientProvider
      dictionary={dictionary}
      initialTranslations={translations}
      initialTranslationsStatus={translationsStatus}
      locale={locale}
      locales={I18NConfig.getLocales()}
      defaultLocale={defaultLocale}
      translationRequired={translationRequired}
      dialectTranslationRequired={dialectTranslationRequired}
      region={_region || (await getRegion())}
      gtServicesEnabled={
        process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED === 'true'
      }
      {...I18NConfig.getClientSideConfig()}
    >
      {children}
    </ClientProvider>
  );
}
