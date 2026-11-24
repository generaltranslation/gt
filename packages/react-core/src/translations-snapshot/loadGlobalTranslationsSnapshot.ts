import type { Locale } from 'gt-i18n/internal';
import { loadTranslationsSnapshot } from './loadTranslationsSnapshot';
import {
  getGlobalTranslationsSnapshot,
  getTranslationsSnapshotLoader,
  isGlobalTranslationsSnapshotInitialized,
  updateGlobalTranslationsSnapshot,
} from './singleton-operations';

const pendingLoads = new Map<Locale, Promise<void>>();

/**
 * Loads a locale into the global translations snapshot with the saved loader
 * settings, once, sharing a load in flight. A failed load leaves the locale
 * out, so the next call loads it again.
 */
export function loadGlobalTranslationsSnapshot(locale: Locale): Promise<void> {
  if (
    isGlobalTranslationsSnapshotInitialized() &&
    getGlobalTranslationsSnapshot()[locale]
  ) {
    return Promise.resolve();
  }
  let load = pendingLoads.get(locale);
  if (!load) {
    load = loadTranslationsSnapshot(getTranslationsSnapshotLoader(), locale)
      .then(updateGlobalTranslationsSnapshot)
      .finally(() => pendingLoads.delete(locale));
    pendingLoads.set(locale, load);
  }
  return load;
}
