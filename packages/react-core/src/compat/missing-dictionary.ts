import { getDictionaryListenerKey } from 'gt-i18n/internal/compat';
import { useCallback } from 'react';
import { useShouldTranslate } from '../hooks/utils';
import { useDevHotReloadQueue } from '../hooks/utils/missing-translation';
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

function useDictionaryHotReloadQueue() {
  const { compatStore } = useDictionaryContext();
  return useDevHotReloadQueue<PendingDictionaryLookup>(
    useShouldTranslate(),
    ({ type, lookup }) => {
      switch (type) {
        case 'dictionaryEntry':
          compatStore.translateDictionaryEntry(lookup);
          break;
        case 'dictionaryObject':
          compatStore.translateDictionaryObject(lookup);
          break;
      }
    }
  );
}

function useHandleMissingDictionaryEntryProd(): OnMissingDictionaryEntry {
  return noopOnMissingDictionaryEntry;
}

function useHandleMissingDictionaryEntryDev(): OnMissingDictionaryEntry {
  const customHandleMissing = useDictionaryContext().onMissingDictionaryEntry;
  const pureHandleMissing = useDictionaryHotReloadQueue();

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
  const pureHandleMissing = useDictionaryHotReloadQueue();
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
