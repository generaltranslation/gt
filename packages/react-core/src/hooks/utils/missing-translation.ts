import { getI18nConfig, getTranslateListenerKey } from 'gt-i18n/internal';
import { useShouldTranslate } from '../utils';
import { useI18nStore } from '../../i18n-store/useI18nStore';
import { TranslateLookup } from '../../i18n-store/storeTypes';
import { useCallback, useEffect } from 'react';
import { Translation } from 'gt-i18n';
import { useGTContext } from '../../context/context';

export type OnMissingTranslation = <T extends Translation>(
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

  // No memoization bc we want to flush after every render
  // TODO: perhaps should find a way to memoize and flush in a better way than this as it nullifies any useCallback
  const pendingLookups = new Map<string, TranslateLookup>();

  // Pure react: effects run after render
  useEffect(() => {
    if (!devHotReloadEnabled || !shouldTranslate || pendingLookups.size === 0) {
      return;
    }

    pendingLookups.forEach((lookup) => {
      i18nStore.translate(lookup);
    });
  }, [devHotReloadEnabled, shouldTranslate, i18nStore, pendingLookups]);

  // No need for useCallback b/c we want access to the pendingLookups map
  return (key: string, lookup: TranslateLookup) => {
    pendingLookups.set(key, lookup);
  };
}
