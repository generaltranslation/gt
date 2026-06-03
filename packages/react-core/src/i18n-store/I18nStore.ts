import {
  getDictionaryListenerKey,
  getTranslateListenerKey,
} from 'gt-i18n/internal';
import type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  DictionaryObjectSnapshot,
  StoreListener,
  TranslateEventListener,
  TranslateLookup,
  TranslateManySnapshot,
  TranslateSnapshot,
  Unsubscribe,
} from './storeTypes';
import type { Dictionary, Translation } from 'gt-i18n/types';
import { RuntimeTranslationScope } from './RuntimeTranslationScope';
import { RuntimeDictionaryScope } from './RuntimeDictionaryScope';
import {
  dictionaryEntryEventMatchesLookup,
  dictionaryObjectEventMatchesLookup,
} from './utils/dictionary-events';
import { subscribeToSet } from './utils/subscriptions';
import { Hash, Locale } from 'gt-i18n/internal/types';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';
import { lookupTranslation } from './lookup-adapter/utils/translations';
import {
  lookupDictionaryEntry,
  lookupDictionaryObject,
} from './lookup-adapter/utils/dictionaries';

type DictionaryStoreListener = (event: DictionaryLookup) => void;

export type I18nStoreParams = {};

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
  private translateManySnapshotCache = new WeakMap<
    readonly TranslateLookup[],
    TranslateManySnapshot
  >();
  private dictionaryEntryListeners = new Set<DictionaryStoreListener>();
  private dictionaryObjectListeners = new Set<DictionaryStoreListener>();

  /**
   * I18nCache must be already initialized
   */
  constructor(_params: I18nStoreParams) {}

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

  subscribeToTranslateMany = <T extends Translation>(
    lookups: readonly TranslateLookup<T>[],
    listener: StoreListener
  ): Unsubscribe => {
    const unsubscribes = lookups.map((lookup) =>
      this.subscribeToTranslate(lookup, listener)
    );
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  };

  subscribeToDictionaryEntry = (
    lookup: DictionaryLookup,
    listener: StoreListener
  ): Unsubscribe => {
    const lookupKey = getDictionaryListenerKey(lookup);
    const wrappedListener: DictionaryStoreListener = (event) => {
      if (dictionaryEntryEventMatchesLookup(event, lookupKey)) {
        listener();
      }
    };
    return subscribeToSet(this.dictionaryEntryListeners, wrappedListener);
  };

  subscribeToDictionaryObject = (
    lookup: DictionaryLookup,
    listener: StoreListener
  ): Unsubscribe => {
    const lookupKey = getDictionaryListenerKey(lookup);
    const wrappedListener: DictionaryStoreListener = (event) => {
      if (dictionaryObjectEventMatchesLookup(event, lookupKey)) {
        listener();
      }
    };
    return subscribeToSet(this.dictionaryObjectListeners, wrappedListener);
  };

  // ----- Snapshots ----- //

  getTranslateSnapshot = <T extends Translation>(
    lookup: TranslateLookup<T>,
    translationsSnapshot: Record<Locale, Record<Hash, Translation>> = {}
  ): TranslateSnapshot<T> => {
    return (
      lookupTranslation(translationsSnapshot, lookup) ??
      getReactI18nCache().lookupTranslation<T>(
        lookup.locale,
        lookup.message,
        lookup.options
      )
    );
  };

  /**
   * We need to preserve identity of snapshot
   */
  getTranslateManySnapshot = <T extends Translation>(
    lookups: readonly TranslateLookup<T>[],
    translationsSnapshot: Record<Locale, Record<Hash, Translation>> = {}
  ): TranslateManySnapshot<T> => {
    const nextSnapshot = lookups.map((lookup) =>
      this.getTranslateSnapshot(lookup, translationsSnapshot)
    );
    const previousSnapshot = this.translateManySnapshotCache.get(lookups);
    if (
      previousSnapshot &&
      previousSnapshot.length === nextSnapshot.length &&
      previousSnapshot.every((value, index) =>
        Object.is(value, nextSnapshot[index])
      )
    ) {
      return previousSnapshot as TranslateManySnapshot<T>;
    }

    this.translateManySnapshotCache.set(lookups, nextSnapshot);
    return nextSnapshot;
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

  // ----- scopes ----- //

  createRuntimeTranslationScope = (): RuntimeTranslationScope => {
    return new RuntimeTranslationScope(this);
  };

  createRuntimeDictionaryScope = (): RuntimeDictionaryScope => {
    return new RuntimeDictionaryScope(this);
  };
}
