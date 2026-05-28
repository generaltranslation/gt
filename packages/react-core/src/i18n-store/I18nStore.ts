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
import type { Translation } from 'gt-i18n/types';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';
import { RuntimeTranslationScope } from './RuntimeTranslationScope';
import { RuntimeDictionaryScope } from './RuntimeDictionaryScope';
import {
  dictionaryEntryEventMatchesLookup,
  dictionaryObjectEventMatchesLookup,
} from './utils/dictionary-events';
import { subscribeToSet } from './utils/subscriptions';

type TranslateStoreListener = (lookup: TranslateLookup) => void;
type DictionaryStoreListener = (event: DictionaryLookup) => void;

export type I18nStoreParams = {};

/**
 * A subscription wrapper around the I18nCache.
 *
 * It is assumed that the I18nCache is already initialized.
 * It is assumed that translations are already sync accessible.
 */
export class I18nStore {
  // ===== Listener Sets ===== //

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
  constructor(_config: I18nStoreParams) {
    try {
      getReactI18nCache();
    } catch (error) {
      throw new Error('Failed to initialize I18nStore. Reason: ' + error);
    }
  }

  // ===== I18nCache Subscriptions ===== //

  subscribeToTranslate<T extends Translation>(
    lookup: TranslateLookup<T>,
    listener: StoreListener
  ): Unsubscribe {
    const lookupKey = getTranslateListenerKey(lookup);
    const wrappedListener: TranslateStoreListener = (lookup) => {
      if (getTranslateListenerKey(lookup) === lookupKey) {
        listener();
      }
    };
    return subscribeToSet(this.translateListeners, wrappedListener);
  }

  subscribeToTranslateMany<T extends Translation>(
    lookups: readonly TranslateLookup<T>[],
    listener: StoreListener
  ): Unsubscribe {
    const unsubscribes = lookups.map((lookup) =>
      this.subscribeToTranslate(lookup, listener)
    );
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }

  subscribeToDictionaryEntry(
    lookup: DictionaryLookup,
    listener: StoreListener
  ): Unsubscribe {
    const lookupKey = getDictionaryListenerKey(lookup);
    const wrappedListener: DictionaryStoreListener = (event) => {
      if (dictionaryEntryEventMatchesLookup(event, lookupKey)) {
        listener();
      }
    };
    return subscribeToSet(this.dictionaryEntryListeners, wrappedListener);
  }

  subscribeToDictionaryObject(
    lookup: DictionaryLookup,
    listener: StoreListener
  ): Unsubscribe {
    const lookupKey = getDictionaryListenerKey(lookup);
    const wrappedListener: DictionaryStoreListener = (event) => {
      if (dictionaryObjectEventMatchesLookup(event, lookupKey)) {
        listener();
      }
    };
    return subscribeToSet(this.dictionaryObjectListeners, wrappedListener);
  }

  // ===== I18nCache Snapshots ===== //

  getTranslateSnapshot = <T extends Translation>({
    locale,
    message,
    options,
  }: TranslateLookup<T>): TranslateSnapshot<T> => {
    return getReactI18nCache().lookupTranslation<T>(locale, message, options);
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
    return getReactI18nCache().lookupDictionary(locale, id);
  };

  getDictionaryObjectSnapshot = ({
    locale,
    id,
  }: DictionaryLookup): DictionaryObjectSnapshot => {
    return getReactI18nCache().lookupDictionaryObj(locale, id);
  };

  // ===== runtime translation ===== //

  translate = <T extends Translation>(lookup: TranslateLookup<T>): void => {
    getReactI18nCache()
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

  // ----- scopes ----- //

  createRuntimeTranslationScope = (): RuntimeTranslationScope => {
    return new RuntimeTranslationScope();
  };

  createRuntimeDictionaryScope = (): RuntimeDictionaryScope => {
    return new RuntimeDictionaryScope();
  };

  // ===== Listener Utilities ===== //

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
