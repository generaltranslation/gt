import {
  getDictionaryListenerKey,
  getTranslateListenerKey,
} from 'gt-i18n/internal';
import type { CustomMapping } from 'generaltranslation/types';
import type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  DictionaryObjectSnapshot,
  ListenerSet,
  StoreListener,
  TranslateLookup,
  TranslateManySnapshot,
  TranslateSnapshot,
  Unsubscribe,
} from './storeTypes';
import type { Translation } from 'gt-i18n/types';
import { getReadonlyConditionStore } from '../condition-store/singleton-operations';
import { getReactI18nManager } from '../i18n-manager/singleton-operations';
import { RuntimeTranslationScope } from './RuntimeTranslationScope';
import { RuntimeDictionaryScope } from './RuntimeDictionaryScope';

type EntryCacheEvent = {
  locale: string;
  id: string;
};
type TranslateStoreListener = (lookup: TranslateLookup) => void;
type DictionaryStoreEvent = EntryCacheEvent;
type DictionaryStoreListener = (event: DictionaryStoreEvent) => void;

export type I18nStoreParams = {};

/**
 * A subscription wrapper around the I18nManager and the ConditionStore
 *
 * It is assumed that the I18nManager and the ConditionStore are already initialized.
 * It is assumed that the locale and translations are already sync accessible.
 */
export class I18nStore {
  // ===== Listener Sets ===== //

  private defaultLocaleListeners: ListenerSet = new Set();
  private localesListeners: ListenerSet = new Set();
  private customMappingListeners: ListenerSet = new Set();
  private enableI18nListeners: ListenerSet = new Set();
  private translateListeners = new Set<TranslateStoreListener>();
  private translateManySnapshotCache = new WeakMap<
    readonly TranslateLookup[],
    TranslateManySnapshot
  >();
  private dictionaryEntryListeners = new Set<DictionaryStoreListener>();
  private dictionaryObjectListeners = new Set<DictionaryStoreListener>();
  private localeListeners: ListenerSet = new Set();

  /**
   * ConditionStore and I18nManager must be already initialized
   */
  constructor(_config: I18nStoreParams) {
    try {
      getReadonlyConditionStore();
      getReactI18nManager();
    } catch (error) {
      throw new Error('Failed to initialize I18nStore. Reason: ' + error);
    }
  }

  // ===== Manager Config Subscriptions ===== //

  subscribeToDefaultLocale = (listener: StoreListener): Unsubscribe => {
    return this.subscribeToStaticSet(this.defaultLocaleListeners, listener);
  };

  subscribeToLocales = (listener: StoreListener): Unsubscribe => {
    return this.subscribeToStaticSet(this.localesListeners, listener);
  };

  subscribeToCustomMapping = (listener: StoreListener): Unsubscribe => {
    return this.subscribeToStaticSet(this.customMappingListeners, listener);
  };

  // ===== ConditionStore Subscriptions ===== //

  subscribeToLocale = (listener: StoreListener): Unsubscribe => {
    return this.subscribeToStaticSet(this.localeListeners, listener);
  };

  subscribeToEnableI18n = (listener: StoreListener): Unsubscribe => {
    return this.subscribeToStaticSet(this.enableI18nListeners, listener);
  };

  // ===== I18nManager Subscriptions ===== //

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
    return this.subscribeToTranslateSet(wrappedListener);
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
    return this.subscribeToDictionarySet(
      this.dictionaryEntryListeners,
      wrappedListener
    );
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
    return this.subscribeToDictionarySet(
      this.dictionaryObjectListeners,
      wrappedListener
    );
  }

  // ===== Manager Config Snapshots ===== //

  getDefaultLocaleSnapshot = (): string => {
    return getReactI18nManager().getDefaultLocale();
  };

  getLocalesSnapshot = (): readonly string[] => {
    return getReactI18nManager().getLocales();
  };

  getCustomMappingSnapshot = (): CustomMapping => {
    return getReactI18nManager().getCustomMapping();
  };

  // ===== ConditionStore Snapshots ===== //

  getLocaleSnapshot = (): string => {
    return getReadonlyConditionStore().getLocale();
  };

  getEnableI18nSnapshot = (): boolean => {
    return getReadonlyConditionStore().getEnableI18n();
  };

  // ===== I18nManager Snapshots ===== //

  getTranslateSnapshot = <T extends Translation>({
    locale,
    message,
    options,
  }: TranslateLookup<T>): TranslateSnapshot<T> => {
    return getReactI18nManager().lookupTranslation<T>(locale, message, options);
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
    return getReactI18nManager().lookupDictionary(locale, id);
  };

  getDictionaryObjectSnapshot = ({
    locale,
    id,
  }: DictionaryLookup): DictionaryObjectSnapshot => {
    return getReactI18nManager().lookupDictionaryObj(locale, id);
  };

  // ===== runtime translation ===== //

  translate = <T extends Translation>(lookup: TranslateLookup<T>): void => {
    getReactI18nManager()
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
    getReactI18nManager()
      .lookupDictionaryWithFallback(lookup.locale, lookup.id)
      .then((dictionaryEntry) => {
        if (dictionaryEntry == null) {
          // TODO: warn about runtime dictionary translation failure
        }
        this.emitDictionaryEvent(lookup);
      });
  };

  translateDictionaryObject = (lookup: DictionaryLookup): void => {
    getReactI18nManager()
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

  private subscribeToStaticSet(
    listenerSet: ListenerSet,
    listener: StoreListener
  ): Unsubscribe {
    listenerSet.add(listener);
    return () => {
      listenerSet.delete(listener);
    };
  }

  private subscribeToTranslateSet(
    listener: TranslateStoreListener
  ): Unsubscribe {
    this.translateListeners.add(listener);
    return () => {
      this.translateListeners.delete(listener);
    };
  }

  private subscribeToDictionarySet(
    listenerSet: Set<DictionaryStoreListener>,
    listener: DictionaryStoreListener
  ): Unsubscribe {
    listenerSet.add(listener);
    return () => {
      listenerSet.delete(listener);
    };
  }

  // ===== Listener Utilities ===== //

  private emitTranslateEvent(event: TranslateLookup): void {
    this.translateListeners.forEach((listener) => listener(event));
  }

  private emitDictionaryEvent(event: DictionaryStoreEvent): void {
    this.dictionaryEntryListeners.forEach((listener) => listener(event));
    this.dictionaryObjectListeners.forEach((listener) => {
      listener(event);
    });
  }
}

// ===== Lookup Keys ===== //

function getDictionaryLookupFromKey(lookupKey: string): DictionaryLookup {
  const separatorIndex = lookupKey.indexOf(':');
  return {
    locale: lookupKey.slice(0, separatorIndex),
    id: lookupKey.slice(separatorIndex + 1),
  };
}

// ===== Event Matching ===== //

function dictionaryEntryEventMatchesLookup(
  event: DictionaryStoreEvent,
  lookupKey: string
): boolean {
  return getDictionaryListenerKey(event) === lookupKey;
}

function dictionaryObjectEventMatchesLookup(
  event: DictionaryStoreEvent,
  lookupKey: string
): boolean {
  const { locale, id } = getDictionaryLookupFromKey(lookupKey);
  if (locale !== event.locale) {
    return false;
  }
  return id === '' || event.id === id || event.id.startsWith(`${id}.`);
}
