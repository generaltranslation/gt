import { mergeDictionaries } from 'gt-react/internal';
import { isValidElement } from 'react';
import { getLocale } from '../request/getLocale';
import { getDictionary, getDictionaryEntry } from '../dictionary/getDictionary';
import { createDictionarySubsetError } from '../errors/createErrors';
import type { Dictionary } from 'gt-i18n/types';
import type { Locale } from 'gt-i18n/internal/types';
import type {
  Dictionary as LegacyDictionary,
  DictionaryEntry,
} from 'gt-react/internal';
import type { GTProviderProps } from '../utils/types';
import { Client_GTProvider } from '../utils/client-boundary';
import { getNextI18nCache } from '../i18n-cache/NextI18nCache';
import { getI18NConfig as getI18NConfiguration } from '../config-dir/getI18NConfig';

export async function GTProvider({ children, id: prefixId }: GTProviderProps) {
  // ---------- SETUP ---------- //
  const i18nCache = getNextI18nCache();
  const I18NConfig = getI18NConfiguration();
  const locale = await getLocale();
  const [translationRequired] = I18NConfig.requiresTranslation(locale);

  // load dictionary
  const dictionaryTranslations =
    (await I18NConfig.getDictionaryTranslations(locale)) || {};

  // ----- FETCH TRANSLATIONS FROM CACHE ----- //

  const translationsSnapshotPromise = translationRequired
    ? i18nCache.loadTranslations(locale)
    : Promise.resolve({});

  // ---------- PROCESS DICTIONARY ---------- //
  // (While waiting for cache...)

  // Get dictionary subset
  let dictionary: LegacyDictionary | DictionaryEntry =
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
    dictionary = prefixPath.reduce<LegacyDictionary>((acc, prefix) => {
      return { [prefix]: acc };
    }, dictionary as LegacyDictionary);
  }

  // Merge dictionary with dictionary translations
  dictionary = mergeDictionaries(dictionary, dictionaryTranslations);

  // Block until cache check resolves
  const translationsSnapshot = { [locale]: await translationsSnapshotPromise };
  const dictionariesSnapshot: Record<Locale, Dictionary> = {
    [locale]: dictionary as unknown as Dictionary,
  };

  return (
    <Client_GTProvider
      enableI18n={true}
      locale={locale}
      translations={translationsSnapshot}
      dictionaries={dictionariesSnapshot}
    >
      {children}
    </Client_GTProvider>
  );
}
