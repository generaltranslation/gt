import { DictionaryEntry } from 'gt-react/internal';
import { isValidElement } from 'react';
import { getI18NConfig } from '../config-dir/getI18NConfig';
import { getLocale } from '../request/getLocale';
import { getDictionary, getDictionaryEntry } from '../dictionary/getDictionary';
import { Dictionary, Translations } from 'gt-react/internal';
import { createDictionarySubsetError } from '../errors/createErrors';
import { ClientProviderWrapper } from './ClientProviderWrapper';
import { GTProviderProps } from '../utils/types';

/*
Note: In normal circumstances, _locale would be at risk of causing hydration errors.
A disparity between _locale and the server side locale will refresh Server Components
so _locale is also reflected by server-rendered content.
*/

export async function GTProvider({
  children,
  id: prefixId,
  locale: _locale,
}: GTProviderProps) {
  // ---------- SETUP ---------- //
  const I18NConfig = getI18NConfig();
  const locale = _locale || (await getLocale());
  const defaultLocale = I18NConfig.getDefaultLocale();
  const [translationRequired] = I18NConfig.requiresTranslation(locale);

  // load dictionary
  const dictionaryTranslations =
    (await I18NConfig.getDictionaryTranslations(locale)) || {};

  // ----- FETCH TRANSLATIONS FROM CACHE ----- //

  const cachedTranslationsPromise: Promise<Translations> = translationRequired
    ? I18NConfig.getCachedTranslations(locale)
    : Promise.resolve({});

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

  // Block until cache check resolves
  const translations = await cachedTranslationsPromise;

  return (
    <ClientProviderWrapper
      dictionary={dictionary}
      dictionaryTranslations={dictionaryTranslations}
      translations={translations}
      locale={locale}
      locales={I18NConfig.getLocales()}
      defaultLocale={defaultLocale}
      environment={
        process.env.NODE_ENV as 'development' | 'production' | 'test'
      }
      gtServicesEnabled={
        process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED === 'true'
      }
      {...I18NConfig.getClientSideConfig()}
    >
      {children}
    </ClientProviderWrapper>
  );
}
