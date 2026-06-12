import { getTranslateListenerKey } from 'gt-i18n/internal';
import type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  DictionaryObjectSnapshot,
  StoreListener,
  TranslateEventListener,
  TranslateLookup,
  TranslateSnapshot,
  Unsubscribe,
} from './storeTypes';
import type { Dictionary, Translation } from 'gt-i18n/types';
import { subscribeToSet } from './utils/subscriptions';
import { Hash, Locale } from 'gt-i18n/internal/types';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';
import { lookupTranslation } from './utils/translations';
import {
  lookupDictionaryEntry,
  lookupDictionaryObject,
} from './utils/dictionaries';

export type DictionaryStoreListener = (event: DictionaryLookup) => void;

/**
 * I18nStore gives us the ability to perform client-side updates to translations.
 * Primarily useful for dev hot reload.
 *
 * This is the stateful primitive behind lookup subscriptions and runtime
 * translation requests. It intentionally does not know whether lookups are
 * being served from SPA singletons or SRA provider snapshots; that policy lives
 * in LookupAdapter, not in this store.
 */
export class I18nStore {
  // ----- Listener Sets ----- //

  private translateListeners = new Set<TranslateEventListener>();
  private dictionaryEntryListeners = new Set<DictionaryStoreListener>();
  private dictionaryObjectListeners = new Set<DictionaryStoreListener>();

  /**
   * I18nCache must be already initialized
   */
  constructor() {}

  // ========== Translation Updates ========== //

  updateTranslations = (
    translations: Record<Locale, Record<Hash, Translation>>
  ): void => {
    getReactI18nCache().updateTranslations(translations);
  };

  updateDictionaries = (dictionaries: Record<Locale, Dictionary>): void => {
    getReactI18nCache().updateDictionaries(dictionaries);
  };

  // ========== runtime translation ========== //

  translate = async <T extends Translation>(
    lookup: TranslateLookup<T>
  ): Promise<void> => {
    return getReactI18nCache()
      .lookupTranslationWithFallback(
        lookup.locale,
        lookup.message,
        lookup.options
      )
      .then((translation) => {
        if (translation == null) {
          // TODO: warn about runtime translation failure
        }
        this.emitTranslateEvent(lookup);
      });
  };

  translateDictionaryEntry = (lookup: DictionaryLookup): void => {
    getReactI18nCache()
      .lookupDictionaryWithFallback(lookup.locale, lookup.id)
      .then((dictionaryEntry) => {
        if (dictionaryEntry == null) {
          // TODO: warn about runtime dictionary translation failure
        }
        this.emitDictionaryEvent(lookup);
      });
  };

  translateDictionaryObject = (lookup: DictionaryLookup): void => {
    getReactI18nCache()
      .lookupDictionaryObjWithFallback(lookup.locale, lookup.id)
      .then((dictionaryObject) => {
        if (dictionaryObject == null) {
          // TODO: warn about runtime dictionary translation failure
        }
        this.emitDictionaryEvent(lookup);
      });
  };

  // ========== UseSyncExternalStore ========== //

  // ----- Subscriptions ----- //

  subscribeToTranslate = <T extends Translation>(
    lookup: TranslateLookup<T>,
    listener: StoreListener
  ): Unsubscribe => {
    const lookupKey = getTranslateListenerKey(lookup);
    const wrappedListener: TranslateEventListener = (lookup) => {
      if (getTranslateListenerKey(lookup) === lookupKey) {
        listener();
      }
    };
    return subscribeToSet(this.translateListeners, wrappedListener);
  };

  subscribeToTranslationEvents = (
    listener: TranslateEventListener
  ): Unsubscribe => {
    return subscribeToSet(this.translateListeners, listener);
  };

  subscribeToDictionaryEntryEvents = (
    listener: DictionaryStoreListener
  ): Unsubscribe => {
    return subscribeToSet(this.dictionaryEntryListeners, listener);
  };

  subscribeToDictionaryObjectEvents = (
    listener: DictionaryStoreListener
  ): Unsubscribe => {
    return subscribeToSet(this.dictionaryObjectListeners, listener);
  };

  // ----- Snapshots ----- //

  getTranslateSnapshot = <T extends Translation>(
    lookup: TranslateLookup<T>,
    translationsSnapshot: Record<Locale, Record<Hash, Translation>> = {}
  ): TranslateSnapshot<T> => {
    console.log('getTranslateSnapshot', getTranslateListenerKey(lookup));
    return (
      lookupTranslation(translationsSnapshot, lookup) ??
      getReactI18nCache().lookupTranslation<T>(
        lookup.locale,
        lookup.message,
        lookup.options
      )
    );
  };

  getDictionaryEntrySnapshot = (
    lookup: DictionaryLookup,
    dictionariesSnapshot: Record<Locale, Dictionary> = {}
  ): DictionaryEntrySnapshot => {
    return (
      lookupDictionaryEntry(dictionariesSnapshot, lookup) ??
      getReactI18nCache().lookupDictionary(lookup.locale, lookup.id)
    );
  };

  getDictionaryObjectSnapshot = (
    lookup: DictionaryLookup,
    dictionariesSnapshot: Record<Locale, Dictionary> = {}
  ): DictionaryObjectSnapshot => {
    return (
      lookupDictionaryObject(dictionariesSnapshot, lookup) ??
      getReactI18nCache().lookupDictionaryObj(lookup.locale, lookup.id)
    );
  };

  // ----- Listener Utilities ----- //

  private emitTranslateEvent(event: TranslateLookup): void {
    this.translateListeners.forEach((listener) => listener(event));
  }

  private emitDictionaryEvent(event: DictionaryLookup): void {
    this.dictionaryEntryListeners.forEach((listener) => listener(event));
    this.dictionaryObjectListeners.forEach((listener) => {
      listener(event);
    });
  }
}
