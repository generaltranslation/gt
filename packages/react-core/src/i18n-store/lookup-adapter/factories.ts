import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import type { GTContextType } from '../../context/context';
import { getI18nStore } from '../singleton-operations';
import type {
  StoreListener,
  TranslateLookup,
  Unsubscribe,
} from '../storeTypes';
import {
  lookupTranslationSnapshot,
  type LookupAdapter,
} from './LookupAdapter';
import type { Translation } from 'gt-i18n/types';

export function createSPALookupAdapter(): LookupAdapter {
  return {
    mode: 'spa',
    subscribeToTranslate,
    getExternalTranslateSnapshot: (lookup) => {
      return getI18nStore().getTranslateSnapshot(lookup);
    },
    getServerTranslateSnapshot: (lookup) => {
      return getI18nStore().getTranslateSnapshot(lookup);
    },
    resolveTranslateSnapshot: (_lookup, externalSnapshot) => {
      return externalSnapshot;
    },
    handleMissingTranslateSnapshot: (lookup) => {
      if (getReactI18nCache().isDevHotReloadEnabled()) {
        getI18nStore().translate(lookup);
      }
    },
  };
}

export function createSRALookupAdapter(
  context: GTContextType
): LookupAdapter {
  const { i18nStore, translationsSnapshot } = context;

  return {
    mode: 'sra',
    subscribeToTranslate: (lookup, listener) => {
      if (!getReactI18nCache().isDevHotReloadEnabled()) {
        return noopSubscribe();
      }
      return i18nStore.subscribeToTranslate(lookup, listener);
    },
    getExternalTranslateSnapshot: (lookup) => {
      if (!getReactI18nCache().isDevHotReloadEnabled()) {
        return undefined;
      }
      return i18nStore.getTranslateSnapshot(lookup);
    },
    getServerTranslateSnapshot: (lookup) => {
      return lookupTranslationSnapshot(translationsSnapshot, lookup);
    },
    resolveTranslateSnapshot: (lookup, externalSnapshot) => {
      return (
        lookupTranslationSnapshot(translationsSnapshot, lookup) ??
        externalSnapshot
      );
    },
    handleMissingTranslateSnapshot: (lookup) => {
      if (getReactI18nCache().isDevHotReloadEnabled()) {
        i18nStore.translate(lookup);
      }
    },
  };
}

function subscribeToTranslate<T extends Translation>(
  lookup: TranslateLookup<T>,
  listener: StoreListener
): Unsubscribe {
  return getI18nStore().subscribeToTranslate(lookup, listener);
}

function noopSubscribe(): Unsubscribe {
  return () => {};
}
