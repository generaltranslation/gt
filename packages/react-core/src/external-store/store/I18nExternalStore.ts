import type { I18nManager } from 'gt-i18n/internal';
import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import type { CustomMapping, IcuMessage } from 'generaltranslation/types';
import {
  DICTIONARY_ENTRY_EVENT_NAME,
  LOCALES_DICTIONARY_EVENT_NAME,
  LOCALES_EVENT_NAME,
  TRANSLATION_EVENT_NAME,
} from './managerEvents';
import type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  DictionaryObjectSnapshot,
  I18nExternalConditionStore,
  ListenerSet,
  StoreListener,
  TranslationLookup,
  TranslationSnapshot,
  Unsubscribe,
} from './storeTypes';
import type {
  DictionaryValue,
  LookupOptions,
  Translation,
} from 'gt-i18n/types';

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

export type I18nExternalStoreParams = {
  i18nManager: I18nManager<Translation>;
  conditionStore: I18nExternalConditionStore;
};

/**
 * External store adapter between React and provider-owned i18n state.
 *
 * Each mutable value exposes a focused getSnapshot/subscribe pair. Derived
 * values stay outside the store so React consumers subscribe only to the data
 * they actually read.
 */
export class I18nExternalStore {
  // ===== Source Instances ===== //

  private i18nManager: I18nManager<Translation>;
  private conditionStore: I18nExternalConditionStore;

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

  constructor({ i18nManager, conditionStore }: I18nExternalStoreParams) {
    this.i18nManager = i18nManager;
    this.conditionStore = conditionStore;
  }

  // ===== Instance Access ===== //

  getI18nManager = (): I18nManager<Translation> => {
    return this.i18nManager;
  };

  // ===== Locale Subscriptions ===== //

  subscribeToLocale = (listener: StoreListener): Unsubscribe => {
    return this.subscribeToSet(this.localeListeners, listener);
  };

  subscribeToRegion = (listener: StoreListener): Unsubscribe => {
    return this.subscribeToSet(this.regionListeners, listener);
  };

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

  subscribeToEnableI18n = (listener: StoreListener): Unsubscribe => {
    return this.subscribeToStaticSet(this.enableI18nListeners, listener);
  };

  // ===== Translation Subscriptions ===== //

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

  // ===== Locale Snapshots ===== //

  getLocaleSnapshot = (): string => {
    return this.conditionStore.getLocale();
  };

  getRegionSnapshot = (): string | undefined => {
    return this.conditionStore.getRegion?.();
  };

  // ===== Manager Config Snapshots ===== //

  getDefaultLocaleSnapshot = (): string => {
    return this.i18nManager.getDefaultLocale();
  };

  getLocalesSnapshot = (): readonly string[] => {
    return this.i18nManager.getLocales();
  };

  getCustomMappingSnapshot = (): CustomMapping => {
    return this.i18nManager.getCustomMapping();
  };

  getEnableI18nSnapshot = (): boolean => {
    return this.i18nManager.isTranslationEnabled();
  };

  // ===== Translation Snapshots ===== //

  getTranslationSnapshot = <T extends Translation>({
    locale,
    message,
    options,
  }: TranslationLookup<T>): TranslationSnapshot<T> => {
    return this.i18nManager.lookupTranslation<T>(locale, message, options);
  };

  getDictionaryEntrySnapshot = ({
    locale,
    id,
  }: DictionaryLookup): DictionaryEntrySnapshot => {
    return this.i18nManager.lookupDictionary(locale, id);
  };

  getDictionaryObjectSnapshot = ({
    locale,
    id,
  }: DictionaryLookup): DictionaryObjectSnapshot => {
    return this.i18nManager.lookupDictionaryObj(locale, id);
  };

  // ===== Setters ===== //

  setLocale = (locale: string): void => {
    if (!this.conditionStore.setLocale) {
      throw new Error(
        'setLocale(): Unable to update locale because the active condition store is not writable.'
      );
    }
    this.conditionStore.setLocale(locale);
  };

  setRegion = (region: string | undefined): void => {
    if (!this.conditionStore.setRegion) {
      throw new Error(
        'setRegion(): Unable to update region because the active condition store is not writable.'
      );
    }
    this.conditionStore.setRegion(region);
  };

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
    this.unsubscribeLocale = this.conditionStore.subscribeToLocale(() => {
      this.emit(this.localeListeners);
    });
    this.unsubscribeRegion = this.conditionStore.subscribeToRegion?.(() => {
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

  // ===== Manager Event Wiring ===== //

  private subscribeToManager(): void {
    // Cache events are invalidation signals. Listeners reread snapshots instead
    // of receiving payload values, matching useSyncExternalStore's contract.
    this.unsubscribeLocalesEvents = this.i18nManager.subscribe(
      LOCALES_EVENT_NAME,
      (event) => {
        this.emitTranslationEvent({
          locale: event.locale,
          value: event.translations,
        });
      }
    );
    this.unsubscribeTranslationEvents = this.i18nManager.subscribe(
      TRANSLATION_EVENT_NAME,
      (event) => {
        this.emitTranslationEvent({
          locale: event.locale,
          id: event.hash,
          value: event.translation,
        });
      }
    );
    this.unsubscribeLocalesDictionaryEvents = this.i18nManager.subscribe(
      LOCALES_DICTIONARY_EVENT_NAME,
      (event) => {
        this.emitDictionaryEvent({
          locale: event.locale,
          value: event.dictionary,
        });
      }
    );
    this.unsubscribeDictionaryEntryEvents = this.i18nManager.subscribe(
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

  // ===== Listener Utilities ===== //

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

// ===== Lookup Keys ===== //

function getTranslationListenerKey<T extends Translation>(
  lookup: TranslationLookup<T> | { locale: string; hash: string }
): string {
  const hash =
    'hash' in lookup
      ? lookup.hash
      : getTranslationHash(lookup.message, lookup.options);
  return `${lookup.locale}:${hash}`;
}

function getDictionaryListenerKey({ locale, id }: DictionaryLookup): string {
  return `${locale}:${id}`;
}

function getDictionaryLookupFromKey(lookupKey: string): DictionaryLookup {
  const separatorIndex = lookupKey.indexOf(':');
  return {
    locale: lookupKey.slice(0, separatorIndex),
    id: lookupKey.slice(separatorIndex + 1),
  };
}

// ===== Event Matching ===== //

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

// ===== Snapshot Helpers ===== //

function getTranslationHash<T extends Translation>(
  message: T,
  options: LookupOptions
): string {
  if (options.$_hash != null) {
    return options.$_hash;
  }

  return hashSource({
    source:
      options.$format === 'ICU' ? indexVars(message as IcuMessage) : message,
    ...(options.$context && { context: options.$context }),
    ...(options.$id && { id: options.$id }),
    ...('$maxChars' in options &&
      options.$maxChars != null && {
        maxChars: Math.abs(options.$maxChars),
      }),
    dataFormat: options.$format,
  });
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
