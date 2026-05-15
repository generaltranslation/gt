import {
  getDictionaryListenerKey,
  getTranslateListenerKey,
} from "gt-i18n/internal";
import type { CustomMapping } from "generaltranslation/types";
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
  OverrideSetLocaleType,
} from "./storeTypes";
import type { Translation } from "gt-i18n/types";
import type { Hash, Locale } from "gt-i18n/internal/types";
import { getConditionStore } from "../condition-store/singleton-operations";
import { getReactI18nManager } from "../i18n-manager/singleton-operations";
import { RuntimeTranslationScope } from "./RuntimeTranslationScope";
import { RuntimeDictionaryScope } from "./RuntimeDictionaryScope";

type TranslationStatusType =
  | { status: "loading"; locale: string }
  | { status: "ready" };

type EntryCacheEvent = {
  locale: string;
  id: string;
};
type TranslateStoreListener = (lookup: TranslateLookup) => void;
type DictionaryStoreEvent = EntryCacheEvent;
type DictionaryStoreListener = (event: DictionaryStoreEvent) => void;
type TranslationsSnapshot = Record<Locale, Record<Hash, Translation>>;

/**
 * @param overrideSetLocale - If provided, will trigger on a locale change
 * instead of a locale state update. This is used when triggering this function
 * will (1) load in new translations and (2) update the locale:
 * - SSR apps: reload server side props, pass new tx obj and new locale to client
 *   thru the provider
 * - SPA: trigger a module-level reload of the app (eg browser refresh or RN reload)
 *
 * If it is not provided, this will trigger an async load of translations. In the meantime,
 * a loading state will be shown. Finally, an event will be emitted updating locale state
 * with synchronous access to new translations.
 */
export type I18nStoreParams = { overrideSetLocale?: OverrideSetLocaleType };

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

  private translationStatusListeners: ListenerSet = new Set();
  private translationStatus: TranslationStatusType = { status: "ready" };

  private overrideSetLocale?: OverrideSetLocaleType;

  /**
   * ConditionStore and I18nManager must be already initialized
   */
  constructor({ overrideSetLocale }: I18nStoreParams) {
    try {
      getConditionStore();
      getReactI18nManager();
    } catch (error) {
      throw new Error("Failed to initialize I18nStore. Reason: " + error);
    }
    this.overrideSetLocale = overrideSetLocale;
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
    listener: StoreListener,
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
    return getConditionStore().getLocale();
  };

  getEnableI18nSnapshot = (): boolean => {
    return getConditionStore().getEnableI18n();
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
        lookup.options,
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

  // ===== set locale operations ===== //

  /**
   * Set locale triggers an async translation load. We only
   * update to the new locale after the translation is complete.
   *
   * We push updates to translationStatus for subscribers to hook into
   * for triggering a re-render.
   *
   * For any SSR, instead we would want to skip a lot of this logic and
   * trigger the server side props to be reloaded instead.
   */
  setLocale = (newLocale: string): void => {
    // Sanitize locale
    const i18nManager = getReactI18nManager();
    const locale = i18nManager.sanitizeLocale(newLocale);
    if (!locale) {
      return;
    }

    // Abort client-reload logic if overrideSetLocale is provided
    // We dont emit an event here because it is assumed that the locale
    // gets updated via this reload (eg browser refresh/SSR reload)
    if (this.overrideSetLocale) {
      getConditionStore().setLocale(locale);
      this.overrideSetLocale(locale);
      return;
    }

    // If already loaded, just immediately emit the status update
    if (
      !i18nManager.requiresTranslation(locale) ||
      i18nManager.hasTranslations(locale)
    ) {
      this.updateTranslationStatus({ status: "ready" });
      getConditionStore().setLocale(locale);
      this.localeListeners.forEach((listener) => listener());
      return;
    }

    // Load new translations and update status and locale
    this.updateTranslationStatus({ status: "loading", locale });
    getReactI18nManager()
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
        getConditionStore().setLocale(locale);
        this.localeListeners.forEach((listener) => listener());
      });
  };

  /**
   * When disabled, we don't show any translations, no formatting, no new requests
   * technically, a user can still switch locales, but we do not fire off any requests
   */
  setEnableI18n = (enableI18n: boolean): void => {
    getConditionStore().setEnableI18n(enableI18n);
    this.updateTranslationStatus({ status: "ready" });
    this.enableI18nListeners.forEach((listener) => listener());
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

  /**
   * This is triggered by a locale change coming from a new locale prop
   * from the GTProvider (along with new translations for that locale)
   *
   * This case does not require an event emission because this occurs
   * before the useSyncExternalStore call in the GTProvider which means
   * that the new locale will be immediately available to the subscribers.
   * Same for the translations too.
   */
  updateLocale = (locale: string): void => {
    getConditionStore().setLocale(locale);
  };

  /**
   * This is triggered by a GTProvider on client so synchronize with server
   * or if done on the server, probably triggered manually
   */
  updateTranslations = (translationsObj: TranslationsSnapshot = {}): void => {
    getReactI18nManager().updateTranslations(translationsObj);
  };

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
    this.translateListeners.add(listener);
    return () => {
      this.translateListeners.delete(listener);
    };
  }

  private subscribeToDictionarySet(
    listenerSet: Set<DictionaryStoreListener>,
    listener: DictionaryStoreListener,
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
  const separatorIndex = lookupKey.indexOf(":");
  return {
    locale: lookupKey.slice(0, separatorIndex),
    id: lookupKey.slice(separatorIndex + 1),
  };
}

// ===== Event Matching ===== //

function dictionaryEntryEventMatchesLookup(
  event: DictionaryStoreEvent,
  lookupKey: string,
): boolean {
  return getDictionaryListenerKey(event) === lookupKey;
}

function dictionaryObjectEventMatchesLookup(
  event: DictionaryStoreEvent,
  lookupKey: string,
): boolean {
  const { locale, id } = getDictionaryLookupFromKey(lookupKey);
  if (locale !== event.locale) {
    return false;
  }
  return id === "" || event.id === id || event.id.startsWith(`${id}.`);
}
