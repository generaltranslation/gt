import {
  getDictionaryListenerKey,
  getI18nConfig,
  getTranslateListenerKey,
} from 'gt-i18n/internal';
import { useShouldTranslate } from '../utils';
import { useI18nStore } from '../../i18n-store/useI18nStore';
import { DictionaryLookup, TranslateLookup } from '../../i18n-store/storeTypes';
import { type RefObject, useCallback, useEffect, useRef } from 'react';
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

  // The enqueue callback must keep a stable identity: an unstable callback
  // would change the identity of every translation function built on top of
  // it (e.g. gt() from useGT()), re-running user effects that depend on it
  // after every render. It reaches the queue of the render in progress through
  // a ref, which is null outside of render.
  const renderLookupsRef = useRef<Map<string, PendingLookup> | null>(null);
  // Lookups made while rendering. Renders in the same synchronous pass share a
  // queue, since strict mode's second render reuses memoized values (and so
  // skips lookups) from the first. A render that never commits (e.g. a
  // suspended transition) takes its queue with it.
  const renderLookups =
    renderLookupsRef.current ?? startRenderLookups(renderLookupsRef);

  // Outside of render (effects, event handlers) side effects are allowed, so
  // lookups are requested right away using the last committed conditions.
  const requestOutsideRenderRef = useRef<
    ((pendingLookup: PendingLookup) => void) | null
  >(null);

  // Pure react: effects run after render
  // No dependency array: flush this render's lookups after every commit
  useEffect(() => {
    renderLookupsRef.current = null;
    const enabled = devHotReloadEnabled && shouldTranslate;
    requestOutsideRenderRef.current = enabled
      ? (pendingLookup) => requestLookup(i18nStore, pendingLookup)
      : null;
    if (enabled) {
      renderLookups.forEach((pendingLookup) =>
        requestLookup(i18nStore, pendingLookup)
      );
    }
    // Strict mode re-runs effects; don't request the same lookups twice
    renderLookups.clear();
  });

  return useCallback((key: string, pendingLookup: PendingLookup) => {
    const currentRenderLookups = renderLookupsRef.current;
    if (currentRenderLookups) {
      currentRenderLookups.set(key, pendingLookup);
    } else {
      requestOutsideRenderRef.current?.(pendingLookup);
    }
  }, []);
}

/**
 * Starts a render's lookup queue. React renders a component synchronously, so
 * the queue stays reachable only until the current task's microtasks run.
 * Later calls (effects, event handlers) are outside of render, even when the
 * render never committed. A child that renders after React yields and calls a
 * parent's translation function is also treated as outside of render, which at
 * worst requests a translation for a render that never commits.
 */
function startRenderLookups(
  renderLookupsRef: RefObject<Map<string, PendingLookup> | null>
): Map<string, PendingLookup> {
  const renderLookups = new Map<string, PendingLookup>();
  renderLookupsRef.current = renderLookups;
  void Promise.resolve().then(() => {
    if (renderLookupsRef.current === renderLookups) {
      renderLookupsRef.current = null;
    }
  });
  return renderLookups;
}

function requestLookup(
  i18nStore: ReturnType<typeof useI18nStore>,
  { type, lookup }: PendingLookup
) {
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
}
