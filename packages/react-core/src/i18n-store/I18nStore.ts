import { getTranslateListenerKey } from 'gt-i18n/internal';
import type { Hash, Locale } from 'gt-i18n/internal/types';
import type { Dictionary, Translation } from 'gt-i18n/types';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';
import {
  getDictionaryEntrySnapshot,
  getDictionaryObjectSnapshot,
  getTranslationSnapshot,
} from '../i18n-cache/snapshots';
import type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  DictionaryObjectSnapshot,
  TranslateLookup,
  TranslateSnapshot,
} from '../i18n-cache/types';

type StoreListener = () => void;
type Unsubscribe = () => void;
type TranslateEventListener = (lookup: TranslateLookup) => void;
export type DictionaryStoreListener = (lookup: DictionaryLookup) => void;

/**
 * @deprecated Runtime translation state now lives in `ReactI18nCache`.
 * This class remains as a stateless compatibility adapter.
 */
export class I18nStore {
  updateTranslations = (
    translations: Record<Locale, Record<Hash, Translation>>
  ): void => getReactI18nCache().updateTranslations(translations);

  updateDictionaries = (dictionaries: Record<Locale, Dictionary>): void =>
    getReactI18nCache().updateDictionaries(dictionaries);

  translate = <T extends Translation>(
    lookup: TranslateLookup<T>
  ): Promise<void> =>
    getReactI18nCache().resolveMissing({ type: 'translation', ...lookup });

  translateDictionaryEntry = (lookup: DictionaryLookup): void => {
    void getReactI18nCache().resolveMissing({
      type: 'dictionaryEntry',
      ...lookup,
    });
  };

  translateDictionaryObject = (lookup: DictionaryLookup): void => {
    void getReactI18nCache().resolveMissing({
      type: 'dictionaryObject',
      ...lookup,
    });
  };

  subscribeToTranslate = <T extends Translation>(
    lookup: TranslateLookup<T>,
    listener: StoreListener
  ): Unsubscribe => {
    const key = getTranslateListenerKey(lookup);
    return getReactI18nCache().subscribe((event) => {
      if (
        event.type === 'translation' &&
        getTranslateListenerKey(event) === key
      ) {
        listener();
      }
    });
  };

  subscribeToTranslationEvents = (
    listener: TranslateEventListener
  ): Unsubscribe =>
    getReactI18nCache().subscribe((event) => {
      if (event.type !== 'translation') return;
      const { type: _type, ...lookup } = event;
      listener(lookup);
    });

  subscribeToDictionaryEntryEvents = subscribeToDictionaryEvents;

  subscribeToDictionaryObjectEvents = subscribeToDictionaryEvents;

  getTranslateSnapshot = <T extends Translation>(
    lookup: TranslateLookup<T>,
    translations: Record<Locale, Record<Hash, Translation>> = {}
  ): TranslateSnapshot<T> =>
    getTranslationSnapshot(getReactI18nCache(), translations, lookup);

  getDictionaryEntrySnapshot = (
    lookup: DictionaryLookup,
    dictionaries: Record<Locale, Dictionary> = {}
  ): DictionaryEntrySnapshot =>
    getDictionaryEntrySnapshot(getReactI18nCache(), dictionaries, lookup);

  getDictionaryObjectSnapshot = (
    lookup: DictionaryLookup,
    dictionaries: Record<Locale, Dictionary> = {}
  ): DictionaryObjectSnapshot =>
    getDictionaryObjectSnapshot(getReactI18nCache(), dictionaries, lookup);
}

function subscribeToDictionaryEvents(
  listener: DictionaryStoreListener
): Unsubscribe {
  return getReactI18nCache().subscribe((event) => {
    if (event.type === 'translation') return;
    const { type: _type, ...lookup } = event;
    listener(lookup);
  });
}
