import { getDictionaryListenerKey, getI18nConfig } from 'gt-i18n/internal';
import { useCallback, useEffect } from 'react';
import { useShouldTranslate } from '../hooks/utils';
import { useDictionaryContext } from './DictionaryContext';
import type {
  DictionaryLookup,
  OnMissingDictionaryEntry,
  OnMissingDictionaryObj,
} from './types';

type PendingDictionaryLookup = {
  type: 'dictionaryEntry' | 'dictionaryObject';
  lookup: DictionaryLookup;
};

/**
 * Dictionary counterpart of the native missing-translation handlers. Runtimes
 * that cannot run effects (server) pass their own onMissingDictionary*
 * callbacks through DictionaryProvider; otherwise misses are queued and
 * translated after commit.
 */

const noopOnMissingDictionaryEntry: OnMissingDictionaryEntry = () => {};
const noopOnMissingDictionaryObj: OnMissingDictionaryObj = () => {};

function useHandleMissingDictionaryEntryProd(): OnMissingDictionaryEntry {
  return noopOnMissingDictionaryEntry;
}

function useHandleMissingDictionaryEntryDev(): OnMissingDictionaryEntry {
  const customHandleMissing = useDictionaryContext().onMissingDictionaryEntry;
  const pureHandleMissing = useDictionaryHotReloadQueue(useShouldTranslate());

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
  const customHandleMissing = useDictionaryContext().onMissingDictionaryObj;
  const pureHandleMissing = useDictionaryHotReloadQueue(useShouldTranslate());
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
function useDictionaryHotReloadQueue(shouldTranslate: boolean) {
  // Statically gated so bundlers can drop dev hot-reload work from
  // production builds.
  const devHotReloadEnabled =
    process.env.NODE_ENV !== 'production' &&
    getI18nConfig().isDevHotReloadEnabled();
  const { compatStore } = useDictionaryContext();

  // No memoization bc we want to flush after every render
  const pendingLookups = new Map<string, PendingDictionaryLookup>();

  // Pure react: effects run after render
  useEffect(() => {
    if (!devHotReloadEnabled || !shouldTranslate || pendingLookups.size === 0) {
      return;
    }

    pendingLookups.forEach(({ type, lookup }) => {
      switch (type) {
        case 'dictionaryEntry':
          compatStore.translateDictionaryEntry(lookup);
          break;
        case 'dictionaryObject':
          compatStore.translateDictionaryObject(lookup);
          break;
      }
    });
  }, [devHotReloadEnabled, shouldTranslate, compatStore, pendingLookups]);

  // No need for useCallback b/c we want access to the pendingLookups map
  return (key: string, pendingLookup: PendingDictionaryLookup) => {
    pendingLookups.set(key, pendingLookup);
  };
}
