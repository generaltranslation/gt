import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
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

export type I18nStoreLookup =
  | { type: 'translation'; lookup: TranslateLookup }
  | {
      type: 'dictionaryEntry' | 'dictionaryObject';
      lookup: DictionaryLookup;
    };

export type ResolveMissing = (lookup: I18nStoreLookup) => Promise<boolean>;

/**
 * I18nStore gives us the ability to perform client-side updates to translations.
 * Primarily useful for dev hot reload.
 *
 * This is the stateful primitive behind lookup subscriptions and runtime
 * translation requests. It intentionally does not know whether lookups are
 * being served from SPA singletons or SRA provider snapshots; that policy lives
 * in LookupAdapter, not in this store.
 */
export class I18nStoreCore {
  // ----- Listener Sets ----- //

  private translateListeners = new Set<TranslateEventListener>();
  private dictionaryEntryListeners = new Set<DictionaryStoreListener>();
  private dictionaryObjectListeners = new Set<DictionaryStoreListener>();

  /**
   * I18nCache must be already initialized
   */
  constructor(private readonly resolveMissing?: ResolveMissing) {}

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
    const resolved = await this.resolveMissing?.({
      type: 'translation',
      lookup,
    });
    if (resolved) this.emitTranslateEvent(lookup);
  };

  translateDictionaryEntry = (lookup: DictionaryLookup): void => {
    void this.resolveMissing?.({ type: 'dictionaryEntry', lookup }).then(
      (resolved) => {
        if (resolved) this.emitDictionaryEvent(lookup);
      }
    );
  };

  translateDictionaryObject = (lookup: DictionaryLookup): void => {
    void this.resolveMissing?.({ type: 'dictionaryObject', lookup }).then(
      (resolved) => {
        if (resolved) this.emitDictionaryEvent(lookup);
      }
    );
  };

  // ========== UseSyncExternalStore ========== //

  // ----- Subscriptions ----- //

  // Keep subscription methods as arrow fields so hooks can pass them by
  // reference without losing access to this store instance.
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

/**
 * I18n store with runtime missing-translation resolution enabled.
 */
export class I18nStore extends I18nStoreCore {
  constructor() {
    super(createResolveMissing());
  }
}

const MAX_LOGGED_RUNTIME_TRANSLATION_ERRORS = 100;

function createResolveMissing(): ResolveMissing {
  const loggedErrors = new Set<string>();

  return (lookup) =>
    resolveLookup(lookup)
      .then(() => true)
      .catch((error) => {
        logError(loggedErrors, error);
        return false;
      });
}

function resolveLookup(lookup: I18nStoreLookup): Promise<unknown> {
  const cache = getReactI18nCache();
  switch (lookup.type) {
    case 'translation':
      return cache.lookupTranslationWithFallback(
        lookup.lookup.locale,
        lookup.lookup.message,
        lookup.lookup.options
      );
    case 'dictionaryEntry':
      return cache.lookupDictionaryWithFallback(
        lookup.lookup.locale,
        lookup.lookup.id
      );
    case 'dictionaryObject':
      return cache.lookupDictionaryObjWithFallback(
        lookup.lookup.locale,
        lookup.lookup.id
      );
  }
}

function logError(loggedErrors: Set<string>, error: unknown): void {
  const key = getErrorKey(error);
  if (loggedErrors.has(key)) return;

  loggedErrors.add(key);
  if (loggedErrors.size > MAX_LOGGED_RUNTIME_TRANSLATION_ERRORS) {
    const oldest = loggedErrors.values().next().value;
    if (oldest !== undefined) loggedErrors.delete(oldest);
  }

  console.error(
    createDiagnosticMessage({
      source: '@generaltranslation/react-core',
      severity: 'Error',
      whatHappened: 'A runtime translation request failed.',
      wayOut: 'Rendering falls back to untranslated content.',
      details: formatDiagnosticErrorDetails(error),
    })
  );
}

function getErrorKey(error: unknown): string {
  if (error instanceof Error) return `${error.name}|${error.message}`;
  if (error !== null && typeof error === 'object') {
    try {
      return `object|${JSON.stringify(error)}`;
    } catch {
      return `object|${String(error)}`;
    }
  }
  return `${typeof error}|${String(error)}`;
}
