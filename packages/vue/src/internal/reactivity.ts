import { shallowRef } from 'vue';
import { createRuntimeTranslationQueue } from 'gt-i18n/internal';

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

// Dev hot reload: runtime translation requests re-render the app when they
// land by invalidating the translations tick.
const queue = createRuntimeTranslationQueue({
  onSettled: invalidateTranslations,
});

export const queueRuntimeTranslation = queue.queueTranslation;
export const queueRuntimeDictionaryTranslation = queue.queueDictionaryEntry;
