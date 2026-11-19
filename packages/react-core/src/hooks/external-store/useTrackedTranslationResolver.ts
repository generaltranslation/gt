import { useCallback, useRef } from 'react';
import { getI18nConfig, getTranslateListenerKey } from 'gt-i18n/internal';
import type { Content } from '@generaltranslation/format';
import type {
  TranslateLookup,
  TranslateSnapshot,
} from '../../i18n-store/storeTypes';
import {
  useI18nStore,
  useTranslationsSnapshot,
} from '../../i18n-store/useI18nStore';
import { useHandleMissingTranslationWithConditions } from '../utils/missing-translation';
import { useSubscribeToTrackedLookups } from './useSubscribeToTrackedLookups';

/**
 * Returns the translation, but also triggers a translation if it is not found
 * when dev hot reload is enabled.
 */
export type TrackedTranslationResolver = <T extends Content>(
  lookup: TranslateLookup<T>
) => TranslateSnapshot<T>;

/**
 * NOTE:
 * t() may be called during render, so tracking intentionally only mutates
 * hook-local refs. This widens the event filter used by our existing
 * useSyncExternalStore subscription, but does not update React state or mutate
 * the translation cache during render.
 *
 * A render that is later aborted may leave behind an extra tracked key. That is
 * acceptable for dev hot reload because the worst case is an unnecessary
 * invalidation for this hook instance, not incorrect rendered output.
 */

export function useTrackedTranslationResolver(
  shouldTranslate: boolean
): TrackedTranslationResolver {
  const translationsSnapshot = useTranslationsSnapshot();
  const i18nStore = useI18nStore();
  const devHotReloadEnabled =
    process.env.NODE_ENV !== 'production' &&
    getI18nConfig().isDevHotReloadEnabled();
  const onMissingTranslation =
    useHandleMissingTranslationWithConditions(shouldTranslate);

  /**
   * Track lookups per hook instance without updating React state during render.
   */
  const trackedKeysRef = useRef<Set<string> | null>(null);
  if (trackedKeysRef.current == null) {
    trackedKeysRef.current = new Set();
  }

  // (tx hot reload) Subscribe to translation updates
  const trackedLookupsVersion = useSubscribeToTrackedLookups(
    trackedKeysRef,
    i18nStore.subscribeToTranslationEvents,
    getTranslateListenerKey
  );

  /**
   * Remember that we can make no assumptions about when this cb gets invoked
   * - Resolves translation from lookup
   * - enqueues dev hot reload (if needed)
   */
  return useCallback(
    <T extends Content>(lookup: TranslateLookup<T>): TranslateSnapshot<T> => {
      // Track the lookup for dev hot reload
      const lookupKey = getTranslateListenerKey(lookup);
      if (devHotReloadEnabled) {
        trackedKeysRef.current!.add(lookupKey);
      }

      // Resolve the translation from the store
      const translation = i18nStore.getTranslateSnapshot(
        lookup,
        translationsSnapshot
      );

      // Trigger a hot reload if the translation is not found
      if (translation == null && devHotReloadEnabled) {
        onMissingTranslation(lookup);
      }
      return translation;
    },
    // trackedLookupsVersion: change identity when a tracked translation arrives
    [
      i18nStore,
      translationsSnapshot,
      onMissingTranslation,
      devHotReloadEnabled,
      trackedLookupsVersion,
    ]
  );
}
