import { getI18nConfig, getTranslateListenerKey } from 'gt-i18n/internal';
import { useShouldTranslate } from '../utils';
import { useI18nStore } from '../../i18n-store/useI18nStore';
import { TranslateLookup } from '../../i18n-store/storeTypes';
import { useCallback, useEffect, useRef } from 'react';
import type { Content } from '@generaltranslation/format';
import { useGTContext } from '../../context/context';

export type OnMissingTranslation = <T extends Content>(
  lookup: TranslateLookup<T>
) => void;

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
        pureHandleMissing(getTranslateListenerKey(lookup), lookup);
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
  const pendingLookupsRef = useRef<Map<string, TranslateLookup> | null>(null);
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

    lookups.forEach((lookup) => {
      i18nStore.translate(lookup);
    });
  });

  return useCallback((key: string, lookup: TranslateLookup) => {
    pendingLookupsRef.current!.set(key, lookup);
  }, []);
}
