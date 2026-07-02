import { getI18nCache } from '../i18n-cache/singleton-operations';
import { getTranslateListenerKey } from '../utils/listenerKeys';
import type { TranslateListenerLookup } from '../utils/listenerKeys';
import type { Translation } from '../i18n-cache/translations-manager/utils/types/translation-data';

export type RuntimeTranslationQueue = {
  /**
   * Requests a runtime translation for a missed lookup (deduped per lookup
   * key, deferred to a microtask). `onSettled` fires once it lands in the
   * cache (or fails), whether or not this call initiated the request.
   */
  queueTranslation: (lookup: {
    locale: string;
    message: Translation;
    options: Record<string, unknown>;
  }) => void;
  /**
   * Same as `queueTranslation`, for a dictionary entry.
   */
  queueDictionaryEntry: (lookup: { locale: string; id: string }) => void;
};

/**
 * Dev hot reload primitive shared by the framework bindings: turns cache
 * misses into batched runtime translation requests and notifies the binding
 * (via `onSettled`) when a translation lands so it can re-render.
 */
export function createRuntimeTranslationQueue({
  onSettled,
}: {
  onSettled: () => void;
}): RuntimeTranslationQueue {
  const inFlightTranslations = new Set<string>();
  const inFlightDictionaryEntries = new Set<string>();

  return {
    queueTranslation(lookup) {
      const key = getTranslateListenerKey(
        lookup as unknown as TranslateListenerLookup
      );
      if (inFlightTranslations.has(key)) return;
      inFlightTranslations.add(key);
      void Promise.resolve()
        .then(() =>
          getI18nCache().lookupTranslationWithFallback(
            lookup.locale,
            lookup.message,
            lookup.options as Parameters<
              ReturnType<typeof getI18nCache>['lookupTranslationWithFallback']
            >[2]
          )
        )
        .catch(() => undefined)
        .then(() => onSettled());
    },

    queueDictionaryEntry(lookup) {
      const key = `${lookup.locale}:${lookup.id}`;
      if (inFlightDictionaryEntries.has(key)) return;
      inFlightDictionaryEntries.add(key);
      void Promise.resolve()
        .then(() =>
          getI18nCache().lookupDictionaryWithFallback(lookup.locale, lookup.id)
        )
        .catch(() => undefined)
        .then(() => onSettled());
    },
  };
}
