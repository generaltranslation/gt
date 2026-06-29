import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import {
  createLookupOptions,
  getI18nConfig,
  getTranslateListenerKey,
} from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import type {
  StoreListener,
  TranslateLookup,
  TranslateSnapshot,
} from '../../i18n-store/storeTypes';
import type { TranslationMetadata } from 'gt-i18n/internal/types';
import type { StringFormat } from '@generaltranslation/format';
import { useLocale } from '../condition-store';
import { useShouldTranslate } from '../utils';
import {
  useI18nStore,
  useTranslationsSnapshot,
} from '../../i18n-store/useI18nStore';
import { useHandleMissingTranslation } from '../utils/missing-translation';

/**
 * Returns the translation, but also triggers a translation if it is not found
 * when dev hot reload is enabled.
 */
export type TrackedTranslationResolver = <T extends Translation>(
  lookup: TranslateLookup<T>
) => TranslateSnapshot<T>;

export type Message = TranslationMetadata & {
  message: string;
};

/**
 * NOTE:
 * gt() may be called during render, so tracking intentionally only mutates
 * hook-local refs. This widens the event filter used by our existing
 * useSyncExternalStore subscription, but does not update React state or mutate
 * the translation cache during render.
 *
 * A render that is later aborted may leave behind an extra tracked key. That is
 * acceptable for dev hot reload because the worst case is an unnecessary
 * invalidation for this hook instance, not incorrect rendered output.
 */

export function useTrackedTranslationResolver(
  messages: Message[] = []
): TrackedTranslationResolver {
  const translationsSnapshot = useTranslationsSnapshot();
  const i18nStore = useI18nStore();
  const devHotReloadEnabled = getI18nConfig().isDevHotReloadEnabled();
  const onMissingTranslation = useHandleMissingTranslation();

  /**
   * Track lookups per hook instance without updating React state during render.
   */
  const trackedKeysRef = useRef<Set<string> | null>(null);
  if (trackedKeysRef.current == null) {
    trackedKeysRef.current = new Set();
  }

  // (optimization) Pre-subscribe to compiler-injected lookups
  usePreloadCompilerLookups(messages, trackedKeysRef);

  // (tx hot reload) Subscribe to translation updates
  useSubscribeToLookups(trackedKeysRef);

  /**
   * Remember that we can make no assumptions about when this cb gets invoked
   * - Resolves translation from lookup
   * - enqueues dev hot reload (if needed)
   */
  return useCallback(
    <T extends Translation>(
      lookup: TranslateLookup<T>
    ): TranslateSnapshot<T> => {
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
    [i18nStore, translationsSnapshot, onMissingTranslation, devHotReloadEnabled]
  );
}

/**
 * Subscribe to translation updates, but only trigger re-renders
 * if the lookup is in the tracked keys. Remember that we can make
 * no assumptions about when this list gets updated. Technically,
 * not pure, but this is an acceptable trade since this is
 * really just for translation hot reload.
 *
 * TODO: (separate PR) we can probably do better filtering for adding to the set since this is primarily dev only
 * TODO: reduce code duplication with the other two useSubscribeToLookups functions
 */
function useSubscribeToLookups(trackedKeysRef: RefObject<Set<string> | null>) {
  // invalidation counter for triggering updates
  const versionRef = useRef(0);
  const i18nStore = useI18nStore();
  const subscribe = useCallback(
    (listener: StoreListener) => {
      return i18nStore.subscribeToTranslationEvents((lookup) => {
        const key = getTranslateListenerKey(lookup);
        if (!trackedKeysRef.current!.has(key)) return;
        versionRef.current++;
        listener();
      });
    },
    [i18nStore]
  );
  const getSnapshot = useCallback(() => {
    return versionRef.current;
  }, []);

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Pre-subscribe to compiler-injected lookups
 * trigger translations for them
 *
 * This ref mutation is safe because this is translation hot reload only
 * and effects are deterministic
 */
function usePreloadCompilerLookups(
  messages: Message[],
  trackedKeysRef: RefObject<Set<string> | null>
) {
  const i18nStore = useI18nStore();
  const locale = useLocale();
  const devHotReloadEnabled = getI18nConfig().isDevHotReloadEnabled();
  const shouldTranslate = useShouldTranslate();
  const translationsSnapshot = useTranslationsSnapshot();
  const txHotReloadEnabled = useMemo(() => {
    return messages?.length > 0 && shouldTranslate && devHotReloadEnabled;
  }, [messages, shouldTranslate, devHotReloadEnabled]);

  // Precompute as much as we can
  const lookups: [TranslateLookup<string>, string][] = useMemo(() => {
    if (!txHotReloadEnabled) return [];
    return messages.map(({ message, ...options }) => {
      const targetLocale = options.$locale ?? locale;
      const lookupOptions = createLookupOptions<StringFormat>(
        targetLocale,
        options,
        'ICU'
      );
      const lookup = {
        locale: targetLocale,
        message,
        options: lookupOptions,
      };
      return [lookup, getTranslateListenerKey(lookup)];
    });
  }, [locale, txHotReloadEnabled, messages]);

  // Pre-subscribe to the lookups
  if (txHotReloadEnabled) {
    lookups.forEach(([, lookupKey]) => {
      trackedKeysRef.current!.add(lookupKey);
    });
  }

  /**
   * Delegate non-pure operations to post commit
   *
   * (Optimization) Trigger a hot reload if the translation is not found
   * for compiler-injected lookups
   *
   * TODO: for use() + suspense strategy, use a Promise.all()
   * TODO: server side translation invocation
   */
  useEffect(() => {
    if (!txHotReloadEnabled) return;

    lookups
      .filter(
        ([lookup]) =>
          i18nStore.getTranslateSnapshot(lookup, translationsSnapshot) == null
      )
      .forEach(([lookup]) => i18nStore.translate(lookup));
  }, [txHotReloadEnabled, i18nStore, lookups, translationsSnapshot]);
}
