import {
  getI18nManager,
  LOCALES_CACHE_MISS_EVENT_NAME,
  type I18nManager,
} from "gt-i18n/internal";
import { hashSource } from "generaltranslation/id";
import { indexVars } from "generaltranslation/internal";
import type { CustomMapping, IcuMessage } from "generaltranslation/types";
import {
  DICTIONARY_ENTRY_EVENT_NAME,
  LOCALES_DICTIONARY_EVENT_NAME,
  LOCALES_EVENT_NAME,
  TRANSLATION_EVENT_NAME,
} from "./managerEvents";
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
} from "./storeTypes";
import type {
  DictionaryValue,
  LookupOptions,
  Translation,
} from "gt-i18n/types";
import { getConditionStore } from "../../state/singleton-operations";

type TranslationStatusType =
  | { status: "loading"; locale: string }
  | { status: "ready" };

type LocaleCacheEvent<T> = {
  locale: string;
  value: Record<string, T>;
};
type EntryCacheEvent<T> = {
  locale: string;
  id: string;
  value: T;
};
type TranslateStoreEvent =
  | LocaleCacheEvent<Translation>
  | EntryCacheEvent<Translation>;
type TranslateStoreListener = (event: TranslateStoreEvent) => void;
type DictionaryStoreEvent =
  | LocaleCacheEvent<DictionaryValue>
  | EntryCacheEvent<DictionaryEntrySnapshot>;
type DictionaryStoreListener = (event: DictionaryStoreEvent) => void;

export type I18nExternalStoreParams = {
  i18nManager: I18nManager<Translation>;
};

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

  private unsubscribeLocalesEvents: Unsubscribe | undefined;
  private unsubscribeTranslateEvents: Unsubscribe | undefined;
  private unsubscribeLocalesDictionaryEvents: Unsubscribe | undefined;
  private unsubscribeDictionaryEntryEvents: Unsubscribe | undefined;

  private translationStatusListeners: ListenerSet = new Set();
  private translationStatus: TranslationStatusType = { status: "ready" };

  constructor() {}

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

  // ===== ConditionStore Subscriptions ===== //

  subscribeToLocale = (listener: StoreListener): Unsubscribe => {
    return this.subscribeToStaticSet(this.localeListeners, listener);
  };

  // ===== I18nManager Subscriptions ===== //

  subscribeToTranslate<T extends Translation>(
    lookup: TranslateLookup<T>,
    listener: StoreListener,
  ): Unsubscribe {
    const lookupKey = getTranslateListenerKey(lookup);
    const wrappedListener: TranslateStoreListener = (event) => {
      if (translateEventMatchesLookup(event, lookupKey)) {
        listener();
      }
    };
    return this.subscribeToTranslateSet(wrappedListener);
  }

  subscribeToTranslateMany<T extends Translation>(
    lookups: readonly TranslateLookup<T>[],
    listener: StoreListener,
  ): Unsubscribe {
    const unsubscribes = lookups.map((lookup) =>
      this.subscribeToTranslate(lookup, listener),
    );
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }

  subscribeToDictionaryEntry(
    lookup: DictionaryLookup,
    listener: StoreListener,
  ): Unsubscribe {
    const lookupKey = getDictionaryListenerKey(lookup);
    const wrappedListener: DictionaryStoreListener = (event) => {
      if (dictionaryEntryEventMatchesLookup(event, lookupKey)) {
        listener();
      }
    };
    return this.subscribeToDictionarySet(
      this.dictionaryEntryListeners,
      wrappedListener,
    );
  }

  subscribeToDictionaryObject(
    lookup: DictionaryLookup,
    listener: StoreListener,
  ): Unsubscribe {
    const lookupKey = getDictionaryListenerKey(lookup);
    const wrappedListener: DictionaryStoreListener = (event) => {
      if (dictionaryObjectEventMatchesLookup(event, lookupKey)) {
        listener();
      }
    };
    return this.subscribeToDictionarySet(
      this.dictionaryObjectListeners,
      wrappedListener,
    );
  }

  // ===== Manager Config Snapshots ===== //

  getDefaultLocaleSnapshot = (): string => {
    return getI18nManager().getDefaultLocale();
  };

  getLocalesSnapshot = (): readonly string[] => {
    return getI18nManager().getLocales();
  };

  getCustomMappingSnapshot = (): CustomMapping => {
    return getI18nManager().getCustomMapping();
  };

  getEnableI18nSnapshot = (): boolean => {
    return getI18nManager().isTranslationEnabled();
  };

  // ===== ConditionStore Snapshots ===== //

  getLocaleSnapshot = (): string => {
    return getConditionStore().getLocale();
  };

  // ===== I18nManager Snapshots ===== //

  getTranslateSnapshot = <T extends Translation>({
    locale,
    message,
    options,
  }: TranslateLookup<T>): TranslateSnapshot<T> => {
    return getI18nManager().lookupTranslation<T>(locale, message, options);
  };

  getTranslateManySnapshot = <T extends Translation>(
    lookups: readonly TranslateLookup<T>[],
  ): TranslateManySnapshot<T> => {
    const nextSnapshot = lookups.map((lookup) =>
      this.getTranslateSnapshot(lookup),
    );
    const previousSnapshot = this.translateManySnapshotCache.get(lookups);
    if (
      previousSnapshot &&
      previousSnapshot.length === nextSnapshot.length &&
      previousSnapshot.every((value, index) =>
        Object.is(value, nextSnapshot[index]),
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
    return getI18nManager().lookupDictionary(locale, id);
  };

  getDictionaryObjectSnapshot = ({
    locale,
    id,
  }: DictionaryLookup): DictionaryObjectSnapshot => {
    return getI18nManager().lookupDictionaryObj(locale, id);
  };

  // ===== set locale operations ===== //

  /**
   * Set locale triggers an async translation load. We only
   * update to the new locale after the translation is complete.
   *
   * We push updates to translationStatus for subscribers to hook into
   * for triggering a re-render.
   */
  setLocale = (locale: string): void => {
    // If already loaded, just immediately emit the status update
    const i18nManager = getI18nManager();
    if (i18nManager.hasTranslations(locale)) {
      this.updateTranslationStatus({ status: "ready" });
      return;
    }

    // Load new translations and update status and locale
    this.updateTranslationStatus({ status: "loading", locale });
    getI18nManager()
      .loadTranslations(locale)
      .then(() => {
        // dedupe update
        if (
          this.translationStatus.status === "ready" ||
          this.translationStatus.locale !== locale
        ) {
          return;
        }
        this.updateTranslationStatus({ status: "ready" });
        this.updateLocale(locale);
      });
  };

  subscribeToTranslationStatus = (listener: StoreListener): Unsubscribe => {
    return this.subscribeToStaticSet(this.translationStatusListeners, listener);
  };

  getTranslationStatusSnapshot = (): TranslationStatusType => {
    return this.translationStatus;
  };

  private updateTranslationStatus = (txStatus: TranslationStatusType): void => {
    // Need to create a new object, otherwise rerender will not trigger
    if (txStatus.status === "loading") {
      this.translationStatus = { status: "loading", locale: txStatus.locale };
    } else {
      this.translationStatus = { status: "ready" };
    }
    this.translationStatusListeners.forEach((listener) => listener());
  };

  private updateLocale = (locale: string): void => {
    getConditionStore().setLocale(locale);
    this.localeListeners.forEach((listener) => listener());
  };

  // ===== Subscription Lifecycle ===== //

  /**
   * Disconnect from all events and listeners.
   */
  public disconnect(): void {
    // this.unsubscribeLocalesEvents?.();
    // this.unsubscribeTranslateEvents?.();
    // this.unsubscribeLocalesDictionaryEvents?.();
    // this.unsubscribeDictionaryEntryEvents?.();
    // this.unsubscribeLocalesEvents = undefined;
    // this.unsubscribeTranslateEvents = undefined;
    // this.unsubscribeLocalesDictionaryEvents = undefined;
    // this.unsubscribeDictionaryEntryEvents = undefined;
  }

  private subscribeToStaticSet(
    listenerSet: ListenerSet,
    listener: StoreListener,
  ): Unsubscribe {
    listenerSet.add(listener);
    return () => {
      listenerSet.delete(listener);
    };
  }

  private subscribeToTranslateSet(
    listener: TranslateStoreListener,
  ): Unsubscribe {
    const hadListeners = this.sourceListenerCount() > 0;
    this.translateListeners.add(listener);
    if (!hadListeners) {
      this.connect();
    }

    return () => {
      this.translateListeners.delete(listener);
      if (this.sourceListenerCount() === 0) {
        this.disconnect();
      }
    };
  }

  private subscribeToDictionarySet(
    listenerSet: Set<DictionaryStoreListener>,
    listener: DictionaryStoreListener,
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
    this.subscribeToManager();
  }

  // ===== Manager Event Wiring ===== //

  private subscribeToManager(): void {
    // Cache events are invalidation signals. Listeners reread snapshots instead
    // of receiving payload values, matching useSyncExternalStore's contract.
    this.unsubscribeLocalesEvents = getI18nManager().subscribe(
      LOCALES_EVENT_NAME,
      (event) => {
        this.emitTranslateEvent({
          locale: event.locale,
          value: event.translations,
        });
      },
    );
    this.unsubscribeTranslateEvents = getI18nManager().subscribe(
      TRANSLATION_EVENT_NAME,
      (event) => {
        this.emitTranslateEvent({
          locale: event.locale,
          id: event.hash,
          value: event.translation,
        });
      },
    );
    this.unsubscribeLocalesDictionaryEvents = getI18nManager().subscribe(
      LOCALES_DICTIONARY_EVENT_NAME,
      (event) => {
        this.emitDictionaryEvent({
          locale: event.locale,
          value: event.dictionary,
        });
      },
    );
    this.unsubscribeDictionaryEntryEvents = getI18nManager().subscribe(
      DICTIONARY_ENTRY_EVENT_NAME,
      (event) => {
        this.emitDictionaryEvent({
          locale: event.locale,
          id: event.id,
          value: event.dictionaryEntry,
        });
      },
    );
  }

  // ===== Listener Utilities ===== //

  private emitTranslateEvent(event: TranslateStoreEvent): void {
    this.translateListeners.forEach((listener) => listener(event));
  }

  private emitDictionaryEvent(event: DictionaryStoreEvent): void {
    this.dictionaryEntryListeners.forEach((listener) => listener(event));
    this.dictionaryObjectListeners.forEach((listener) => {
      listener(event);
    });
  }

  private sourceListenerCount(): number {
    return (
      this.translateListeners.size +
      this.dictionaryEntryListeners.size +
      this.dictionaryObjectListeners.size
    );
  }
}

// ===== Lookup Keys ===== //

function getTranslateListenerKey<T extends Translation>(
  lookup: TranslateLookup<T> | { locale: string; hash: string },
): string {
  const hash =
    "hash" in lookup
      ? lookup.hash
      : getTranslateHash(lookup.message, lookup.options);
  return `${lookup.locale}:${hash}`;
}

function getDictionaryListenerKey({ locale, id }: DictionaryLookup): string {
  return `${locale}:${id}`;
}

function getDictionaryLookupFromKey(lookupKey: string): DictionaryLookup {
  const separatorIndex = lookupKey.indexOf(":");
  return {
    locale: lookupKey.slice(0, separatorIndex),
    id: lookupKey.slice(separatorIndex + 1),
  };
}

// ===== Event Matching ===== //

function translateEventMatchesLookup(
  event: TranslateStoreEvent,
  lookupKey: string,
): boolean {
  if ("id" in event) {
    return (
      getTranslateListenerKey({
        locale: event.locale,
        hash: event.id,
      }) === lookupKey
    );
  }
  return Object.keys(event.value).some(
    (hash) =>
      getTranslateListenerKey({ locale: event.locale, hash }) === lookupKey,
  );
}

function dictionaryEntryEventMatchesLookup(
  event: DictionaryStoreEvent,
  lookupKey: string,
): boolean {
  if ("id" in event) {
    return getDictionaryListenerKey(event) === lookupKey;
  }
  const { locale, id } = getDictionaryLookupFromKey(lookupKey);
  const value = getDictionaryPathValue(event.value, id);
  return locale === event.locale && value != null && !isDictionaryObject(value);
}

function dictionaryObjectEventMatchesLookup(
  event: DictionaryStoreEvent,
  lookupKey: string,
): boolean {
  const { locale, id } = getDictionaryLookupFromKey(lookupKey);
  if (locale !== event.locale) {
    return false;
  }
  if ("id" in event) {
    return id === "" || event.id === id || event.id.startsWith(`${id}.`);
  }
  return getDictionaryPathValue(event.value, id) != null;
}

// ===== Snapshot Helpers ===== //

function getTranslateHash<T extends Translation>(
  message: T,
  options: LookupOptions,
): string {
  if (options.$_hash != null) {
    return options.$_hash;
  }

  return hashSource({
    source:
      options.$format === "ICU" ? indexVars(message as IcuMessage) : message,
    ...(options.$context && { context: options.$context }),
    ...(options.$id && { id: options.$id }),
    ...("$maxChars" in options &&
      options.$maxChars != null && {
        maxChars: Math.abs(options.$maxChars),
      }),
    dataFormat: options.$format,
  });
}

function getDictionaryPathValue(
  dictionary: Record<string, DictionaryValue>,
  id: string,
): DictionaryValue | undefined {
  return id
    .split(".")
    .filter(Boolean)
    .reduce<DictionaryValue | undefined>((value, key) => {
      if (!isDictionaryObject(value)) {
        return undefined;
      }
      return value[key];
    }, dictionary);
}

function isDictionaryObject(
  value: DictionaryValue | undefined,
): value is Record<string, DictionaryValue> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}
