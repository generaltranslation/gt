import {
  getDictionaryListenerKey,
  getI18nConfig,
  getTranslateListenerKey,
} from 'gt-i18n/internal';
import { useShouldTranslate } from '../utils';
import { useI18nStore } from '../../i18n-store/useI18nStore';
import { DictionaryLookup, TranslateLookup } from '../../i18n-store/storeTypes';
import { useCallback, useEffect, useRef } from 'react';
import { Translation } from 'gt-i18n/types';
import { useGTContext } from '../../context/context';

export type OnMissingTranslation = <T extends Translation>(
  lookup: TranslateLookup<T>
) => void;
export type OnMissingDictionaryEntry = (lookup: DictionaryLookup) => void;
// TODO: rename to OnMissingDictionaryObject
export type OnMissingDictionaryObj = (lookup: DictionaryLookup) => void;

type PendingLookup =
  | {
      type: 'translation';
      lookup: TranslateLookup;
    }
  | {
      type: 'dictionaryEntry' | 'dictionaryObject';
      lookup: DictionaryLookup;
    };

/**
 * Why have custom handleMissing functions?
 *
 * Some runtimes (like server) cannot make useEffect calls, so
 * we need to give them access to a callback where they can embed
 * their own translation calls
 *
 * While this is technnically not pure behavior, this is acceptable
 * in development hot reload
 */

const noopOnMissingTranslation: OnMissingTranslation = () => {};
const noopOnMissingDictionaryEntry: OnMissingDictionaryEntry = () => {};
const noopOnMissingDictionaryObj: OnMissingDictionaryObj = () => {};

// TODO: reduce code duplication with the three below functions
function useHandleMissingTranslationProd(): OnMissingTranslation {
  return noopOnMissingTranslation;
}

function useHandleMissingTranslationDev(): OnMissingTranslation {
  return useHandleMissingTranslationWithConditionsDev(useShouldTranslate());
}

function useHandleMissingTranslationWithConditionsDev(
  shouldTranslate: boolean
): OnMissingTranslation {
  const customHandleMissing = useGTContext()?.onMissingTranslation;
  const pureHandleMissing = useDevHotReloadQueue(shouldTranslate);

  return useCallback(
    (lookup: TranslateLookup) => {
      if (customHandleMissing) {
        customHandleMissing(lookup);
      } else {
        pureHandleMissing(getTranslateListenerKey(lookup), {
          type: 'translation',
          lookup,
        });
      }
    },
    [customHandleMissing, pureHandleMissing]
  );
}

function useHandleMissingDictionaryEntryProd(): OnMissingDictionaryEntry {
  return noopOnMissingDictionaryEntry;
}

function useHandleMissingDictionaryEntryDev(): OnMissingDictionaryEntry {
  const customHandleMissing = useGTContext()?.onMissingDictionaryEntry;
  const pureHandleMissing = useDevHotReloadQueue(useShouldTranslate());

  return useCallback(
    (lookup: DictionaryLookup) => {
      if (customHandleMissing) {
        customHandleMissing(lookup);
      } else {
        pureHandleMissing(getDictionaryListenerKey(lookup), {
          type: 'dictionaryEntry',
          lookup,
        });
      }
    },
    [customHandleMissing, pureHandleMissing]
  );
}

function useHandleMissingDictionaryObjectProd(): OnMissingDictionaryObj {
  return noopOnMissingDictionaryObj;
}

function useHandleMissingDictionaryObjectDev(): OnMissingDictionaryObj {
  const customHandleMissing = useGTContext()?.onMissingDictionaryObj;
  const pureHandleMissing = useDevHotReloadQueue(useShouldTranslate());
  return useCallback(
    (lookup: DictionaryLookup) => {
      if (customHandleMissing) {
        customHandleMissing(lookup);
      } else {
        pureHandleMissing(getDictionaryListenerKey(lookup), {
          type: 'dictionaryObject',
          lookup,
        });
      }
    },
    [customHandleMissing, pureHandleMissing]
  );
}

export const useHandleMissingTranslation: () => OnMissingTranslation =
  process.env.NODE_ENV === 'production'
    ? useHandleMissingTranslationProd
    : useHandleMissingTranslationDev;

export const useHandleMissingTranslationWithConditions: (
  shouldTranslate: boolean
) => OnMissingTranslation =
  process.env.NODE_ENV === 'production'
    ? useHandleMissingTranslationProd
    : useHandleMissingTranslationWithConditionsDev;

export const useHandleMissingDictionaryEntry: () => OnMissingDictionaryEntry =
  process.env.NODE_ENV === 'production'
    ? useHandleMissingDictionaryEntryProd
    : useHandleMissingDictionaryEntryDev;

export const useHandleMissingDictionaryObject: () => OnMissingDictionaryObj =
  process.env.NODE_ENV === 'production'
    ? useHandleMissingDictionaryObjectProd
    : useHandleMissingDictionaryObjectDev;

/**
 * HMR translation needs to be deferred to post-commit phase
 */
function useDevHotReloadQueue(shouldTranslate: boolean) {
  // Statically gated so bundlers can drop dev hot-reload work from
  // production builds.
  const devHotReloadEnabled =
    process.env.NODE_ENV !== 'production' &&
    getI18nConfig().isDevHotReloadEnabled();
  const i18nStore = useI18nStore();

  // Persist the queue across renders so the enqueue callback keeps a stable
  // identity. An unstable callback would change the identity of every
  // translation function built on top of it (e.g. gt() from useGT()), which
  // re-runs user effects that depend on it after every render.
  const pendingLookupsRef = useRef<Map<string, PendingLookup> | null>(null);
  if (pendingLookupsRef.current == null) {
    pendingLookupsRef.current = new Map();
  }

  // Pure react: effects run after render
  // No dependency array: flush whatever was enqueued after every commit
  useEffect(() => {
    const pendingLookups = pendingLookupsRef.current!;
    if (pendingLookups.size === 0) return;
    const lookups = Array.from(pendingLookups.values());
    pendingLookups.clear();
    if (!devHotReloadEnabled || !shouldTranslate) return;

    lookups.forEach(({ type, lookup }) => {
      switch (type) {
        case 'translation':
          i18nStore.translate(lookup);
          break;
        case 'dictionaryEntry':
          i18nStore.translateDictionaryEntry(lookup);
          break;
        case 'dictionaryObject':
          i18nStore.translateDictionaryObject(lookup);
          break;
      }
    });
  });

  return useCallback((key: string, pendingLookup: PendingLookup) => {
    pendingLookupsRef.current!.set(key, pendingLookup);
  }, []);
}
