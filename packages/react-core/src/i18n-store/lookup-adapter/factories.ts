import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import type { GTContextType } from '../../context/context';
import { getI18nStore } from '../singleton-operations';
import type {
  DictionaryLookup,
  StoreListener,
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

const EMPTY_TRANSLATIONS = Object.freeze([]);

export function createSPALookupAdapter(): LookupAdapter {
  return {
    mode: 'spa',
    subscribeToTranslate,
    getStoreTranslation: (lookup) => {
      return getI18nStore().getTranslateSnapshot(lookup);
    },
    getServerTranslation: (lookup) => {
      return getI18nStore().getTranslateSnapshot(lookup);
    },
    resolveTranslation: (_lookup, storeTranslation) => {
      return storeTranslation;
    },
    handleMissingTranslation: (lookup) => {
      if (getReactI18nCache().isDevHotReloadEnabled()) {
        getI18nStore().translate(lookup);
      }
    },
    subscribeToTranslateMany,
    getStoreTranslations: (lookups) => {
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
    getStoreDictionaryEntry: (lookup) => {
      return getI18nStore().getDictionaryEntrySnapshot(lookup);
    },
    getServerDictionaryEntry: (lookup) => {
      return getI18nStore().getDictionaryEntrySnapshot(lookup);
    },
    resolveDictionaryEntry: (_lookup, storeDictionaryEntry) => {
      return storeDictionaryEntry;
    },
    handleMissingDictionaryEntry: (lookup) => {
      if (getReactI18nCache().isDevHotReloadEnabled()) {
        getI18nStore().translateDictionaryEntry(lookup);
      }
    },
    subscribeToDictionaryObject,
    getStoreDictionaryObject: (lookup) => {
      return getI18nStore().getDictionaryObjectSnapshot(lookup);
    },
    getServerDictionaryObject: (lookup) => {
      return getI18nStore().getDictionaryObjectSnapshot(lookup);
    },
    resolveDictionaryObject: (_lookup, storeDictionaryObject) => {
      return storeDictionaryObject;
    },
    handleMissingDictionaryObject: (lookup) => {
      if (getReactI18nCache().isDevHotReloadEnabled()) {
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
    mode: 'sra',
    subscribeToTranslate: (lookup, listener) => {
      if (!getReactI18nCache().isDevHotReloadEnabled()) {
        return noopSubscribe();
      }
      return i18nStore.subscribeToTranslate(lookup, listener);
    },
    getStoreTranslation: (lookup) => {
      if (!getReactI18nCache().isDevHotReloadEnabled()) {
        return undefined;
      }
      return i18nStore.getTranslateSnapshot(lookup);
    },
    getServerTranslation: (lookup) => {
      return lookupTranslation(translationsSnapshot, lookup);
    },
    resolveTranslation: (lookup, storeTranslation) => {
      return (
        lookupTranslation(translationsSnapshot, lookup) ?? storeTranslation
      );
    },
    handleMissingTranslation: (lookup) => {
      if (getReactI18nCache().isDevHotReloadEnabled()) {
        i18nStore.translate(lookup);
      }
    },
    subscribeToTranslateMany: (lookups, listener) => {
      if (!getReactI18nCache().isDevHotReloadEnabled()) {
        return noopSubscribe();
      }
      return i18nStore.subscribeToTranslateMany(lookups, listener);
    },
    getStoreTranslations: (lookups) => {
      if (!getReactI18nCache().isDevHotReloadEnabled()) {
        return EMPTY_TRANSLATIONS;
      }
      return i18nStore.getTranslateManySnapshot(lookups);
    },
    getServerTranslations: (lookups) => {
      return lookupTranslations(translationsSnapshot, lookups);
    },
    resolveTranslations: (lookups, storeTranslations) => {
      return lookupTranslations(
        translationsSnapshot,
        lookups,
        storeTranslations
      );
    },
    handleMissingTranslations: (lookups, translations) => {
      if (!getReactI18nCache().isDevHotReloadEnabled()) return;
      lookups.forEach((lookup, index) => {
        if (translations[index] == null) {
          i18nStore.translate(lookup);
        }
      });
    },
    subscribeToDictionaryEntry: (lookup, listener) => {
      if (!getReactI18nCache().isDevHotReloadEnabled()) {
        return noopSubscribe();
      }
      return i18nStore.subscribeToDictionaryEntry(lookup, listener);
    },
    getStoreDictionaryEntry: (lookup) => {
      if (!getReactI18nCache().isDevHotReloadEnabled()) {
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
      if (getReactI18nCache().isDevHotReloadEnabled()) {
        i18nStore.translateDictionaryEntry(lookup);
      }
    },
    subscribeToDictionaryObject: (lookup, listener) => {
      if (!getReactI18nCache().isDevHotReloadEnabled()) {
        return noopSubscribe();
      }
      return i18nStore.subscribeToDictionaryObject(lookup, listener);
    },
    getStoreDictionaryObject: (lookup) => {
      if (!getReactI18nCache().isDevHotReloadEnabled()) {
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
      if (getReactI18nCache().isDevHotReloadEnabled()) {
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
  if (!getReactI18nCache().isDevHotReloadEnabled()) return;
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
