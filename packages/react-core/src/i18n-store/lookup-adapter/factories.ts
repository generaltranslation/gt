import type { GTContextType } from '../../context/context';
import { getI18nStore } from '../singleton-operations';
import type {
  DictionaryLookup,
  StoreListener,
  TranslateEventListener,
  TranslateLookup,
  TranslateManySnapshot,
  Unsubscribe,
} from '../storeTypes';
import {
  lookupDictionaryEntry,
  lookupDictionaryObject,
} from './utils/dictionaries';
import { lookupTranslation, lookupTranslations } from './utils/translations';
import { type LookupAdapter } from './LookupAdapter';
import type { Translation } from 'gt-i18n/types';
import { getI18nConfig } from 'gt-i18n/internal';

const EMPTY_TRANSLATIONS = Object.freeze([]);

export function createSPALookupAdapter(): LookupAdapter {
  return {
    mode: 'SPA',
    subscribeToTranslate,
    subscribeToTranslationEvents,
    getTranslationSnapshot: (lookup) => {
      return getI18nStore().getTranslateSnapshot(lookup);
    },
    resolveTranslation: (_lookup, storeTranslation) => {
      return storeTranslation;
    },
    handleMissingTranslation: (lookup) => {
      if (getI18nConfig().isDevHotReloadEnabled()) {
        getI18nStore().translate(lookup);
      }
    },
    subscribeToTranslateMany,
    getTranslationsSnapshot: (lookups) => {
      return getI18nStore().getTranslateManySnapshot(lookups);
    },
    getServerTranslations: (lookups) => {
      return getI18nStore().getTranslateManySnapshot(lookups);
    },
    resolveTranslations: (_lookups, storeTranslations) => {
      return storeTranslations;
    },
    handleMissingTranslations,
    subscribeToDictionaryEntry,
    getDictionaryEntrySnapshot: (lookup) => {
      return getI18nStore().getDictionaryEntrySnapshot(lookup);
    },
    getServerDictionaryEntry: (lookup) => {
      return getI18nStore().getDictionaryEntrySnapshot(lookup);
    },
    resolveDictionaryEntry: (_lookup, storeDictionaryEntry) => {
      return storeDictionaryEntry;
    },
    handleMissingDictionaryEntry: (lookup) => {
      if (getI18nConfig().isDevHotReloadEnabled()) {
        getI18nStore().translateDictionaryEntry(lookup);
      }
    },
    subscribeToDictionaryObject,
    getDictionaryObjectSnapshot: (lookup) => {
      return getI18nStore().getDictionaryObjectSnapshot(lookup);
    },
    getServerDictionaryObject: (lookup) => {
      return getI18nStore().getDictionaryObjectSnapshot(lookup);
    },
    resolveDictionaryObject: (_lookup, storeDictionaryObject) => {
      return storeDictionaryObject;
    },
    handleMissingDictionaryObject: (lookup) => {
      if (getI18nConfig().isDevHotReloadEnabled()) {
        getI18nStore().translateDictionaryObject(lookup);
      }
    },
    createRuntimeTranslationScope: () => {
      return getI18nStore().createRuntimeTranslationScope();
    },
    createRuntimeDictionaryScope: () => {
      return getI18nStore().createRuntimeDictionaryScope();
    },
  };
}

export function createSRALookupAdapter(context: GTContextType): LookupAdapter {
  const { dictionariesSnapshot, i18nStore, translationsSnapshot } = context;

  return {
    mode: 'server-render',
    subscribeToTranslate: (lookup, listener) => {
      if (!getI18nConfig().isDevHotReloadEnabled()) {
        return noopSubscribe();
      }
      return i18nStore.subscribeToTranslate(lookup, listener);
    },
    subscribeToTranslationEvents: (listener) => {
      if (!getI18nConfig().isDevHotReloadEnabled()) {
        return noopSubscribe();
      }
      return i18nStore.subscribeToTranslationEvents(listener);
    },
    getTranslationSnapshot: (lookup) => {
      // SRA rule: only in dev hot reload, fallback to i18nStore
      return (lookupTranslation(translationsSnapshot, lookup) ??
        getI18nConfig().isDevHotReloadEnabled())
        ? i18nStore.getTranslateSnapshot(lookup)
        : undefined;
    },
    resolveTranslation: (lookup, storeTranslation) => {
      return (
        lookupTranslation(translationsSnapshot, lookup) ?? storeTranslation
      );
    },
    handleMissingTranslation: (lookup) => {
      if (getI18nConfig().isDevHotReloadEnabled()) {
        i18nStore.translate(lookup);
      }
    },
    subscribeToTranslateMany: (lookups, listener) => {
      if (!getI18nConfig().isDevHotReloadEnabled()) {
        return noopSubscribe();
      }
      return i18nStore.subscribeToTranslateMany(lookups, listener);
    },
    getTranslationsSnapshot: (lookups) => {
      if (!getI18nConfig().isDevHotReloadEnabled()) {
        return EMPTY_TRANSLATIONS;
      }
      return i18nStore.getTranslateManySnapshot(lookups);
    },
    getServerTranslations: (lookups) => {
      if (lookups.length === 0) {
        return EMPTY_TRANSLATIONS;
      }
      return lookupTranslations(translationsSnapshot, lookups);
    },
    resolveTranslations: (lookups, storeTranslations) => {
      if (lookups.length === 0) {
        return EMPTY_TRANSLATIONS;
      }
      /**
       * TODO:
       * For SRA, do we want the server to always win out?
       * If client somehow changes a value, wouldn't we want that to win
       * in the next render cycle?
       */
      return lookupTranslations(
        translationsSnapshot,
        lookups,
        storeTranslations
      );
    },
    handleMissingTranslations: (lookups, translations) => {
      if (!getI18nConfig().isDevHotReloadEnabled()) return;
      lookups.forEach((lookup, index) => {
        if (translations[index] == null) {
          i18nStore.translate(lookup);
        }
      });
    },
    subscribeToDictionaryEntry: (lookup, listener) => {
      if (!getI18nConfig().isDevHotReloadEnabled()) {
        return noopSubscribe();
      }
      return i18nStore.subscribeToDictionaryEntry(lookup, listener);
    },
    getDictionaryEntrySnapshot: (lookup) => {
      if (!getI18nConfig().isDevHotReloadEnabled()) {
        return undefined;
      }
      return i18nStore.getDictionaryEntrySnapshot(lookup);
    },
    getServerDictionaryEntry: (lookup) => {
      return lookupDictionaryEntry(dictionariesSnapshot, lookup);
    },
    resolveDictionaryEntry: (lookup, storeDictionaryEntry) => {
      return (
        lookupDictionaryEntry(dictionariesSnapshot, lookup) ??
        storeDictionaryEntry
      );
    },
    handleMissingDictionaryEntry: (lookup) => {
      if (getI18nConfig().isDevHotReloadEnabled()) {
        i18nStore.translateDictionaryEntry(lookup);
      }
    },
    subscribeToDictionaryObject: (lookup, listener) => {
      if (!getI18nConfig().isDevHotReloadEnabled()) {
        return noopSubscribe();
      }
      return i18nStore.subscribeToDictionaryObject(lookup, listener);
    },
    getDictionaryObjectSnapshot: (lookup) => {
      if (!getI18nConfig().isDevHotReloadEnabled()) {
        return undefined;
      }
      return i18nStore.getDictionaryObjectSnapshot(lookup);
    },
    getServerDictionaryObject: (lookup) => {
      return lookupDictionaryObject(dictionariesSnapshot, lookup);
    },
    resolveDictionaryObject: (lookup, storeDictionaryObject) => {
      return (
        lookupDictionaryObject(dictionariesSnapshot, lookup) ??
        storeDictionaryObject
      );
    },
    handleMissingDictionaryObject: (lookup) => {
      if (getI18nConfig().isDevHotReloadEnabled()) {
        i18nStore.translateDictionaryObject(lookup);
      }
    },
    createRuntimeTranslationScope: () => {
      return i18nStore.createRuntimeTranslationScope();
    },
    createRuntimeDictionaryScope: () => {
      return i18nStore.createRuntimeDictionaryScope();
    },
  };
}

function subscribeToTranslate<T extends Translation>(
  lookup: TranslateLookup<T>,
  listener: StoreListener
): Unsubscribe {
  return getI18nStore().subscribeToTranslate(lookup, listener);
}

function subscribeToTranslationEvents(
  listener: TranslateEventListener
): Unsubscribe {
  return getI18nStore().subscribeToTranslationEvents(listener);
}

function subscribeToTranslateMany<T extends Translation>(
  lookups: readonly TranslateLookup<T>[],
  listener: StoreListener
): Unsubscribe {
  return getI18nStore().subscribeToTranslateMany(lookups, listener);
}

function handleMissingTranslations<T extends Translation>(
  lookups: readonly TranslateLookup<T>[],
  translations: TranslateManySnapshot<T>
): void {
  if (!getI18nConfig().isDevHotReloadEnabled()) return;
  lookups.forEach((lookup, index) => {
    if (translations[index] == null) {
      getI18nStore().translate(lookup);
    }
  });
}

function subscribeToDictionaryEntry(
  lookup: DictionaryLookup,
  listener: StoreListener
): Unsubscribe {
  return getI18nStore().subscribeToDictionaryEntry(lookup, listener);
}

function subscribeToDictionaryObject(
  lookup: DictionaryLookup,
  listener: StoreListener
): Unsubscribe {
  return getI18nStore().subscribeToDictionaryObject(lookup, listener);
}

function noopSubscribe(): Unsubscribe {
  return () => {};
}
