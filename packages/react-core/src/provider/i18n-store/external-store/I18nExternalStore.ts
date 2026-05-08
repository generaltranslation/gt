import { getI18nManager } from 'gt-i18n/internal';
import {
  getLocaleSnapshot as readLocaleSnapshot,
  getRegionSnapshot as readRegionSnapshot,
  setLocale as setConditionLocale,
  setRegion as setConditionRegion,
  subscribeToLocale as subscribeToConditionLocale,
  subscribeToRegion as subscribeToConditionRegion,
} from '../state/externalConditionStore';
import {
  DICTIONARY_ENTRY_EVENT_NAME,
  LOCALES_DICTIONARY_EVENT_NAME,
  LOCALES_EVENT_NAME,
  TRANSLATION_EVENT_NAME,
} from '../utils/managerEvents';
import {
  getCustomMappingSnapshot as readCustomMappingSnapshot,
  getDefaultLocaleSnapshot as readDefaultLocaleSnapshot,
  getDictionaryEntrySnapshot as readDictionaryEntrySnapshot,
  getDictionaryObjectSnapshot as readDictionaryObjectSnapshot,
  getEnableI18nSnapshot as readEnableI18nSnapshot,
  getLocalesSnapshot as readLocalesSnapshot,
  getTranslationHash,
  getTranslationSnapshot as readTranslationSnapshot,
} from '../state/readSnapshots';
import type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  DictionaryObjectSnapshot,
  ListenerSet,
  StoreListener,
  TranslationLookup,
  TranslationSnapshot,
  Unsubscribe,
} from '../storeTypes';
import type { DictionaryValue, Translation } from 'gt-i18n/types';

type LocaleCacheEvent<T> = {
  locale: string;
  value: Record<string, T>;
};
type EntryCacheEvent<T> = {
  locale: string;
  id: string;
  value: T;
};
type TranslationStoreEvent =
  | LocaleCacheEvent<Translation>
  | EntryCacheEvent<Translation>;
type TranslationStoreListener = (event: TranslationStoreEvent) => void;
type DictionaryStoreEvent =
  | LocaleCacheEvent<DictionaryValue>
  | EntryCacheEvent<DictionaryEntrySnapshot>;
type DictionaryStoreListener = (event: DictionaryStoreEvent) => void;

/**
 * Minimal external store adapter between React and the gt-i18n singletons.
 *
 * Each externally mutable resource has its own snapshot getter and subscriber
 * set. Derived values should be calculated by consumers from these primitives.
 */
export class I18nExternalStore {
  // ===== Listener Sets ===== //

  private localeListeners: ListenerSet = new Set();
  private regionListeners: ListenerSet = new Set();
  private defaultLocaleListeners: ListenerSet = new Set();
  private localesListeners: ListenerSet = new Set();
  private customMappingListeners: ListenerSet = new Set();
  private enableI18nListeners: ListenerSet = new Set();
  private translationListeners = new Set<TranslationStoreListener>();
  private dictionaryEntryListeners = new Set<DictionaryStoreListener>();
  private dictionaryObjectListeners = new Set<DictionaryStoreListener>();

  private unsubscribeLocale: Unsubscribe | undefined;
  private unsubscribeRegion: Unsubscribe | undefined;
  private unsubscribeLocalesEvents: Unsubscribe | undefined;
  private unsubscribeTranslationEvents: Unsubscribe | undefined;
  private unsubscribeLocalesDictionaryEvents: Unsubscribe | undefined;
  private unsubscribeDictionaryEntryEvents: Unsubscribe | undefined;

  // ===== Subscriptions ===== //

  subscribeToLocale = (listener: StoreListener): Unsubscribe => {
    return this.subscribeToSet(this.localeListeners, listener);
  };

  subscribeToRegion = (listener: StoreListener): Unsubscribe => {
    return this.subscribeToSet(this.regionListeners, listener);
  };

  // These manager config values do not have runtime update events today.
  // Keep separate subscribers so hooks can read a narrow snapshot now and gain
  // targeted invalidation later if those config values become mutable.
  subscribeToDefaultLocale = (listener: StoreListener): Unsubscribe => {
    return this.subscribeToStaticSet(this.defaultLocaleListeners, listener);
  };

  subscribeToLocales = (listener: StoreListener): Unsubscribe => {
    return this.subscribeToStaticSet(this.localesListeners, listener);
  };

  subscribeToCustomMapping = (listener: StoreListener): Unsubscribe => {
    return this.subscribeToStaticSet(this.customMappingListeners, listener);
  };

  subscribeToEnableI18n = (listener: StoreListener): Unsubscribe => {
    return this.subscribeToStaticSet(this.enableI18nListeners, listener);
  };

  subscribeToTranslation<T extends Translation>(
    lookup: TranslationLookup<T>,
    listener: StoreListener
  ): Unsubscribe {
    const lookupKey = getTranslationListenerKey(lookup);
    const wrappedListener: TranslationStoreListener = (event) => {
      if (translationEventMatchesLookup(event, lookupKey)) {
        listener();
      }
    };
    return this.subscribeToTranslationSet(wrappedListener);
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

  // ===== Snapshots ===== //

  getLocaleSnapshot = readLocaleSnapshot;

  getRegionSnapshot = readRegionSnapshot;

  getDefaultLocaleSnapshot = readDefaultLocaleSnapshot;

  getLocalesSnapshot = readLocalesSnapshot;

  getCustomMappingSnapshot = readCustomMappingSnapshot;

  getEnableI18nSnapshot = readEnableI18nSnapshot;

  getTranslationSnapshot<T extends Translation>(
    lookup: TranslationLookup<T>
  ): TranslationSnapshot<T> {
    return readTranslationSnapshot(lookup);
  }

  getDictionaryEntrySnapshot(
    lookup: DictionaryLookup
  ): DictionaryEntrySnapshot {
    return readDictionaryEntrySnapshot(lookup);
  }

  getDictionaryObjectSnapshot(
    lookup: DictionaryLookup
  ): DictionaryObjectSnapshot {
    return readDictionaryObjectSnapshot(lookup);
  }

  // ===== Setters ===== //

  setLocale(locale: string): void {
    setConditionLocale(locale);
  }

  setRegion(region: string | undefined): void {
    setConditionRegion(region);
  }

  // ===== Subscription Lifecycle ===== //

  private subscribeToStaticSet(
    listenerSet: ListenerSet,
    listener: StoreListener
  ): Unsubscribe {
    listenerSet.add(listener);
    return () => {
      listenerSet.delete(listener);
    };
  }

  private subscribeToSet(
    listenerSet: ListenerSet,
    listener: StoreListener
  ): Unsubscribe {
    const hadListeners = this.sourceListenerCount() > 0;
    listenerSet.add(listener);
    if (!hadListeners) {
      this.connect();
    }

    return () => {
      listenerSet.delete(listener);
      if (this.sourceListenerCount() === 0) {
        this.disconnect();
      }
    };
  }

  private subscribeToTranslationSet(
    listener: TranslationStoreListener
  ): Unsubscribe {
    const hadListeners = this.sourceListenerCount() > 0;
    this.translationListeners.add(listener);
    if (!hadListeners) {
      this.connect();
    }

    return () => {
      this.translationListeners.delete(listener);
      if (this.sourceListenerCount() === 0) {
        this.disconnect();
      }
    };
  }

  private subscribeToDictionarySet(
    listenerSet: Set<DictionaryStoreListener>,
    listener: DictionaryStoreListener
  ): Unsubscribe {
    const hadListeners = this.sourceListenerCount() > 0;
    listenerSet.add(listener);
    if (!hadListeners) {
      this.connect();
    }

    return () => {
      listenerSet.delete(listener);
      if (this.sourceListenerCount() === 0) {
        this.disconnect();
      }
    };
  }

  private connect(): void {
    this.unsubscribeLocale = subscribeToConditionLocale(() => {
      this.emit(this.localeListeners);
    });
    this.unsubscribeRegion = subscribeToConditionRegion(() => {
      this.emit(this.regionListeners);
    });
    this.subscribeToManager();
  }

  private disconnect(): void {
    this.unsubscribeLocale?.();
    this.unsubscribeRegion?.();
    this.unsubscribeLocalesEvents?.();
    this.unsubscribeTranslationEvents?.();
    this.unsubscribeLocalesDictionaryEvents?.();
    this.unsubscribeDictionaryEntryEvents?.();
    this.unsubscribeLocale = undefined;
    this.unsubscribeRegion = undefined;
    this.unsubscribeLocalesEvents = undefined;
    this.unsubscribeTranslationEvents = undefined;
    this.unsubscribeLocalesDictionaryEvents = undefined;
    this.unsubscribeDictionaryEntryEvents = undefined;
  }

  // ===== Source Wiring ===== //

  private subscribeToManager(): void {
    const manager = getI18nManager();
    // Cache events are invalidation signals. Listeners reread snapshots instead
    // of receiving payload values, matching useSyncExternalStore's contract.
    this.unsubscribeLocalesEvents = manager.subscribe(
      LOCALES_EVENT_NAME,
      (event) => {
        this.emitTranslationEvent({
          locale: event.locale,
          value: event.translations,
        });
      }
    );
    this.unsubscribeTranslationEvents = manager.subscribe(
      TRANSLATION_EVENT_NAME,
      (event) => {
        this.emitTranslationEvent({
          locale: event.locale,
          id: event.hash,
          value: event.translation,
        });
      }
    );
    this.unsubscribeLocalesDictionaryEvents = manager.subscribe(
      LOCALES_DICTIONARY_EVENT_NAME,
      (event) => {
        this.emitDictionaryEvent({
          locale: event.locale,
          value: event.dictionary,
        });
      }
    );
    this.unsubscribeDictionaryEntryEvents = manager.subscribe(
      DICTIONARY_ENTRY_EVENT_NAME,
      (event) => {
        this.emitDictionaryEvent({
          locale: event.locale,
          id: event.id,
          value: event.dictionaryEntry,
        });
      }
    );
  }

  // ===== Utilities ===== //

  private emit(listenerSet: ListenerSet): void {
    listenerSet.forEach((listener) => listener());
  }

  private emitTranslationEvent(event: TranslationStoreEvent): void {
    this.translationListeners.forEach((listener) => listener(event));
  }

  private emitDictionaryEvent(event: DictionaryStoreEvent): void {
    this.dictionaryEntryListeners.forEach((listener) => listener(event));
    this.dictionaryObjectListeners.forEach((listener) => {
      listener(event);
    });
  }

  private sourceListenerCount(): number {
    return (
      this.localeListeners.size +
      this.regionListeners.size +
      this.translationListeners.size +
      this.dictionaryEntryListeners.size +
      this.dictionaryObjectListeners.size
    );
  }
}

function getTranslationListenerKey<T extends Translation>(
  lookup: TranslationLookup<T> | { locale: string; hash: string }
): string {
  const hash =
    'hash' in lookup
      ? lookup.hash
      : getTranslationHash(lookup.message, lookup.options);
  return `${lookup.locale}:${hash}`;
}

function translationEventMatchesLookup(
  event: TranslationStoreEvent,
  lookupKey: string
): boolean {
  if ('id' in event) {
    return (
      getTranslationListenerKey({
        locale: event.locale,
        hash: event.id,
      }) === lookupKey
    );
  }
  return Object.keys(event.value).some(
    (hash) =>
      getTranslationListenerKey({ locale: event.locale, hash }) === lookupKey
  );
}

function getDictionaryListenerKey({ locale, id }: DictionaryLookup): string {
  return `${locale}:${id}`;
}

function dictionaryEntryEventMatchesLookup(
  event: DictionaryStoreEvent,
  lookupKey: string
): boolean {
  if ('id' in event) {
    return getDictionaryListenerKey(event) === lookupKey;
  }
  const { locale, id } = getDictionaryLookupFromKey(lookupKey);
  const value = getDictionaryPathValue(event.value, id);
  return locale === event.locale && value != null && !isDictionaryObject(value);
}

function dictionaryObjectEventMatchesLookup(
  event: DictionaryStoreEvent,
  lookupKey: string
): boolean {
  const { locale, id } = getDictionaryLookupFromKey(lookupKey);
  if (locale !== event.locale) {
    return false;
  }
  if ('id' in event) {
    return id === '' || event.id === id || event.id.startsWith(`${id}.`);
  }
  return getDictionaryPathValue(event.value, id) != null;
}

function getDictionaryLookupFromKey(lookupKey: string): DictionaryLookup {
  const separatorIndex = lookupKey.indexOf(':');
  return {
    locale: lookupKey.slice(0, separatorIndex),
    id: lookupKey.slice(separatorIndex + 1),
  };
}

function getDictionaryPathValue(
  dictionary: Record<string, DictionaryValue>,
  id: string
): DictionaryValue | undefined {
  return id
    .split('.')
    .filter(Boolean)
    .reduce<DictionaryValue | undefined>((value, key) => {
      if (!isDictionaryObject(value)) {
        return undefined;
      }
      return value[key];
    }, dictionary);
}

function isDictionaryObject(
  value: DictionaryValue | undefined
): value is Record<string, DictionaryValue> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}
