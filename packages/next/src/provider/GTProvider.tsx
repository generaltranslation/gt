import { mergeDictionaries } from 'gt-react/internal';
import { isValidElement } from 'react';
import { getI18NConfig } from '../config-dir/getI18NConfig';
import { getLocale } from '../request/getLocale';
import { getDictionary, getDictionaryEntry } from '../dictionary/getDictionary';
import { createDictionarySubsetError } from '../errors/createErrors';
import { GTProvider as ReactGTProvider } from 'gt-react/context';
import type { Dictionary, Translation } from 'gt-i18n/types';
import type { Hash, Locale } from 'gt-i18n/internal/types';
import type {
  Dictionary as LegacyDictionary,
  DictionaryEntry,
  Translations as LegacyTranslations,
} from 'gt-react/internal';
import type { GTProviderProps } from '../utils/types';

function toTranslationSnapshot(
  translations: LegacyTranslations
): Record<Hash, Translation> {
  return Object.fromEntries(
    Object.entries(translations).filter(
      (entry): entry is [Hash, Translation] => entry[1] != null
    )
  );
}

export async function GTProvider({
  children,
  id: prefixId,
  locale: _locale,
}: GTProviderProps) {
  // ---------- SETUP ---------- //
  const I18NConfig = getI18NConfig();
  const locale = _locale || (await getLocale());
  const [translationRequired] = I18NConfig.requiresTranslation(locale);

  // load dictionary
  const dictionaryTranslations =
    (await I18NConfig.getDictionaryTranslations(locale)) || {};

  // ----- FETCH TRANSLATIONS FROM CACHE ----- //

  const cachedTranslationsPromise: Promise<LegacyTranslations> =
    translationRequired
      ? I18NConfig.getCachedTranslations(locale)
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
  const translations = await cachedTranslationsPromise;
  const dictionariesSnapshot: Record<Locale, Dictionary> = {
    [locale]: dictionary as unknown as Dictionary,
  };
  const translationsSnapshot: Record<Locale, Record<Hash, Translation>> = {
    [locale]: toTranslationSnapshot(translations),
  };

  return (
    <ReactGTProvider
      dictionaries={dictionariesSnapshot}
      enableI18n={translationRequired}
      locale={locale}
      translations={translationsSnapshot}
    >
      {children}
    </ReactGTProvider>
  );
}
