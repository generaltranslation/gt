import { shallowRef } from 'vue';
import { getI18nCache, getTranslateListenerKey } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';

/**
 * Global reactive tick for translation-cache changes.
 *
 * Every translation lookup (`<T>`, `gt()`, `t()`, dictionary functions) reads
 * this ref during render, so bumping it re-renders everything that depends on
 * a translation — used when the initial load completes and when dev hot
 * reload translations land.
 */
const translationsTick = shallowRef(0);

export function trackTranslations(): void {
  void translationsTick.value;
}

export function invalidateTranslations(): void {
  translationsTick.value++;
}

// ===== Dev hot reload ===== //

type TranslateLookup = {
  locale: string;
  message: unknown;
  options: Record<string, unknown>;
};

const inFlightTranslations = new Set<string>();
const inFlightDictionaryEntries = new Set<string>();

/**
 * Dev hot reload: requests a runtime translation for a missed lookup (deduped
 * per lookup key, deferred to a microtask) and invalidates translations once
 * it lands in the cache.
 */
export function queueRuntimeTranslation(lookup: TranslateLookup): void {
  const key = getTranslateListenerKey(
    lookup as Parameters<typeof getTranslateListenerKey>[0]
  );
  if (inFlightTranslations.has(key)) return;
  inFlightTranslations.add(key);
  void Promise.resolve()
    .then(() =>
      getI18nCache().lookupTranslationWithFallback(
        lookup.locale,
        lookup.message as Translation,
        lookup.options as Parameters<
          ReturnType<typeof getI18nCache>['lookupTranslationWithFallback']
        >[2]
      )
    )
    .catch(() => undefined)
    .then(() => invalidateTranslations());
}

/**
 * Dev hot reload for dictionary entries.
 */
export function queueRuntimeDictionaryTranslation(lookup: {
  locale: string;
  id: string;
}): void {
  const key = `${lookup.locale}:${lookup.id}`;
  if (inFlightDictionaryEntries.has(key)) return;
  inFlightDictionaryEntries.add(key);
  void Promise.resolve()
    .then(() =>
      getI18nCache().lookupDictionaryWithFallback(lookup.locale, lookup.id)
    )
    .catch(() => undefined)
    .then(() => invalidateTranslations());
}
