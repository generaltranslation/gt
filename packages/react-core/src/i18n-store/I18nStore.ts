import {
  getDictionaryListenerKey,
  getTranslateListenerKey,
} from 'gt-i18n/internal';
import type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  DictionaryObjectSnapshot,
  StoreListener,
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
import {
  ReactI18nCache,
  ReactI18nCacheParams,
} from '../i18n-cache/ReactI18nCache';

type TranslateStoreListener = (lookup: TranslateLookup) => void;
type DictionaryStoreListener = (event: DictionaryLookup) => void;

export type I18nStoreParams = {
  i18nCacheParams: ReactI18nCacheParams;
};

/**
 * I18nStore gives us the ability to perform client-side updates to translations.
 * Primarily useful for dev hot reload.
 *
 * Not relevant for initial hydration.
 */
export class I18nStore {
  // ----- State ----- //

  private i18nCache: ReactI18nCache;

  // ----- Listener Sets ----- //

  private translateListeners = new Set<TranslateStoreListener>();
  private translateManySnapshotCache = new WeakMap<
    readonly TranslateLookup[],
    TranslateManySnapshot
  >();
  private dictionaryEntryListeners = new Set<DictionaryStoreListener>();
  private dictionaryObjectListeners = new Set<DictionaryStoreListener>();

  /**
   * I18nCache must be already initialized
   */
  constructor({ i18nCacheParams }: I18nStoreParams) {
    this.i18nCache = new ReactI18nCache(i18nCacheParams);
  }

  // ========== Translation Updates ========== //

  updateTranslations = (
    translations: Record<Locale, Record<Hash, Translation>>
  ): void => {
    this.i18nCache.updateTranslations(translations);
  };

  updateDictionaries = (dictionaries: Record<Locale, Dictionary>): void => {
    this.i18nCache.updateDictionaries(dictionaries);
  };

  // ========== runtime translation ========== //

  translate = <T extends Translation>(lookup: TranslateLookup<T>): void => {
    this.i18nCache
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
    this.i18nCache
      .lookupDictionaryWithFallback(lookup.locale, lookup.id)
      .then((dictionaryEntry) => {
        if (dictionaryEntry == null) {
          // TODO: warn about runtime dictionary translation failure
        }
        this.emitDictionaryEvent(lookup);
      });
  };

  translateDictionaryObject = (lookup: DictionaryLookup): void => {
    this.i18nCache
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
    const wrappedListener: TranslateStoreListener = (lookup) => {
      if (getTranslateListenerKey(lookup) === lookupKey) {
        listener();
      }
    };
    return subscribeToSet(this.translateListeners, wrappedListener);
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

  getTranslateSnapshot = <T extends Translation>({
    locale,
    message,
    options,
  }: TranslateLookup<T>): TranslateSnapshot<T> => {
    return this.i18nCache.lookupTranslation<T>(locale, message, options);
  };

  getTranslateManySnapshot = <T extends Translation>(
    lookups: readonly TranslateLookup<T>[]
  ): TranslateManySnapshot<T> => {
    const nextSnapshot = lookups.map((lookup) =>
      this.getTranslateSnapshot(lookup)
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

  getDictionaryEntrySnapshot = ({
    locale,
    id,
  }: DictionaryLookup): DictionaryEntrySnapshot => {
    return this.i18nCache.lookupDictionary(locale, id);
  };

  getDictionaryObjectSnapshot = ({
    locale,
    id,
  }: DictionaryLookup): DictionaryObjectSnapshot => {
    return this.i18nCache.lookupDictionaryObj(locale, id);
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
