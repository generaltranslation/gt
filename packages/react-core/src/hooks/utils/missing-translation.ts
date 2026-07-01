import {
  getDictionaryListenerKey,
  getI18nConfig,
  getTranslateListenerKey,
} from 'gt-i18n/internal';
import { useShouldTranslate } from '../utils';
import { useI18nStore } from '../../i18n-store/useI18nStore';
import { DictionaryLookup, TranslateLookup } from '../../i18n-store/storeTypes';
import { useCallback, useEffect } from 'react';
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

// TODO: reduce code duplication with the three below functions
export function useHandleMissingTranslation(): OnMissingTranslation {
  const customHandleMissing = useGTContext()?.onMissingTranslation;
  const pureHandleMissing = useDevHotReloadQueue();

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

export function useHandleMissingDictionaryEntry(): OnMissingDictionaryEntry {
  const customHandleMissing = useGTContext()?.onMissingDictionaryEntry;
  const pureHandleMissing = useDevHotReloadQueue();

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

export function useHandleMissingDictionaryObject(): OnMissingDictionaryObj {
  const customHandleMissing = useGTContext()?.onMissingDictionaryObj;
  const pureHandleMissing = useDevHotReloadQueue();
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

/**
 * HMR translation needs to be deferred to post-commit phase
 */
function useDevHotReloadQueue() {
  // Statically gated so bundlers can drop dev hot-reload work from
  // production builds.
  const devHotReloadEnabled =
    process.env.NODE_ENV !== 'production' &&
    getI18nConfig().isDevHotReloadEnabled();
  const shouldTranslate = useShouldTranslate();
  const i18nStore = useI18nStore();

  // No memoization bc we want to flush after every render
  // TODO: perhaps should find a way to memoize and flush in a better way than this as it nullifies any useCallback
  const pendingLookups = new Map<string, PendingLookup>();

  // Pure react: effects run after render
  useEffect(() => {
    if (!devHotReloadEnabled || !shouldTranslate || pendingLookups.size === 0) {
      return;
    }

    pendingLookups.forEach(({ type, lookup }) => {
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
  }, [devHotReloadEnabled, shouldTranslate, i18nStore, pendingLookups]);

  // No need for useCallback b/c we want access to the pendingLookups map
  return (key: string, pendingLookup: PendingLookup) => {
    pendingLookups.set(key, pendingLookup);
  };
}
