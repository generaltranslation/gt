import type { Locale } from 'gt-i18n/internal';
import {
  getDictionaryManager,
  initializeDictionaryManager,
  isDictionaryManagerInitialized,
  type Dictionary,
} from 'gt-i18n/internal/compat';
import type { Unsubscribe } from '../i18n-store/storeTypes';
import { subscribeToSet } from '../i18n-store/utils/subscriptions';
import { createRuntimeTranslationErrorLogger } from '../i18n-store/utils/runtimeTranslationErrors';
import { lookupDictionaryEntry, lookupDictionaryObject } from './dictionaries';
import type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  DictionaryObjectSnapshot,
  DictionaryStoreListener,
} from './types';

/**
 * Runtimes that only receive dictionaries through provider snapshots (such as
 * the gt-next client) never initialize a DictionaryManager. Create one without
 * a loader; its entries cannot be refreshed, so they never expire.
 */
function getOrCreateDictionaryManager() {
  if (!isDictionaryManagerInitialized()) {
    initializeDictionaryManager({ cacheExpiryTime: null });
  }
  return getDictionaryManager();
}

/**
 * Render-time reads and server-side translations must not create a manager:
 * an empty one would stop gt-next from seeding the bundled dictionary later.
 * Only updateDictionaries() (a client effect) creates one.
 */
function getExistingDictionaryManager() {
  return isDictionaryManagerInitialized() ? getDictionaryManager() : undefined;
}

/**
 * Dictionary counterpart of I18nStore: syncs DictionaryManager updates with
 * renders and drives dictionary dev hot reload.
 */
export class CompatStore {
  // ----- Listener Sets ----- //

  private dictionaryEntryListeners = new Set<DictionaryStoreListener>();
  private dictionaryObjectListeners = new Set<DictionaryStoreListener>();
  private logRuntimeTranslationError = createRuntimeTranslationErrorLogger();

  // ========== Dictionary Updates ========== //

  updateDictionaries = (dictionaries: Record<Locale, Dictionary>): void => {
    if (Object.keys(dictionaries).length === 0) return;
    getOrCreateDictionaryManager().updateDictionaries(dictionaries);
  };

  // ========== runtime translation ========== //

  translateDictionaryEntry = (lookup: DictionaryLookup): void => {
    // Without a manager there is no source dictionary to translate from.
    getExistingDictionaryManager()
      ?.lookupDictionaryWithFallback(lookup.locale, lookup.id)
      .then(() => {
        this.emitDictionaryEvent(lookup);
      })
      .catch((error) => this.logRuntimeTranslationError(error));
  };

  translateDictionaryObject = (lookup: DictionaryLookup): void => {
    getExistingDictionaryManager()
      ?.lookupDictionaryObjWithFallback(lookup.locale, lookup.id)
      .then(() => {
        this.emitDictionaryEvent(lookup);
      })
      .catch((error) => this.logRuntimeTranslationError(error));
  };

  // ========== UseSyncExternalStore ========== //

  // ----- Subscriptions ----- //

  // Keep subscription methods as arrow fields so hooks can pass them by
  // reference without losing access to this store instance.
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

  getDictionaryEntrySnapshot = (
    lookup: DictionaryLookup,
    dictionariesSnapshot: Record<Locale, Dictionary> = {}
  ): DictionaryEntrySnapshot => {
    return (
      lookupDictionaryEntry(dictionariesSnapshot, lookup) ??
      getExistingDictionaryManager()?.lookupDictionary(lookup.locale, lookup.id)
    );
  };

  getDictionaryObjectSnapshot = (
    lookup: DictionaryLookup,
    dictionariesSnapshot: Record<Locale, Dictionary> = {}
  ): DictionaryObjectSnapshot => {
    return (
      lookupDictionaryObject(dictionariesSnapshot, lookup) ??
      getExistingDictionaryManager()?.lookupDictionaryObj(
        lookup.locale,
        lookup.id
      )
    );
  };

  // ----- Listener Utilities ----- //

  private emitDictionaryEvent(event: DictionaryLookup): void {
    this.dictionaryEntryListeners.forEach((listener) => listener(event));
    this.dictionaryObjectListeners.forEach((listener) => {
      listener(event);
    });
  }
}
