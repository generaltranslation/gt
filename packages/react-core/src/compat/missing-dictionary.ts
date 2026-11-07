import { getI18nConfig } from 'gt-i18n/internal';
import { getDictionaryListenerKey } from 'gt-i18n/internal/compat';
import { useCallback, useEffect, useRef } from 'react';
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

  // Persist the queue across renders so the enqueue callback keeps a stable
  // identity, like the native translation queue.
  const pendingLookupsRef = useRef<Map<string, PendingDictionaryLookup> | null>(
    null
  );
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
        case 'dictionaryEntry':
          compatStore.translateDictionaryEntry(lookup);
          break;
        case 'dictionaryObject':
          compatStore.translateDictionaryObject(lookup);
          break;
      }
    });
  });

  return useCallback((key: string, pendingLookup: PendingDictionaryLookup) => {
    pendingLookupsRef.current!.set(key, pendingLookup);
  }, []);
}
