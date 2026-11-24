import { dedupePending, type Locale } from 'gt-i18n/internal';
import { loadTranslationsSnapshot } from './loadTranslationsSnapshot';
import {
  fillGlobalTranslationsSnapshot,
  getGlobalTranslationsSnapshot,
  getTranslationsSnapshotLoader,
  isGlobalTranslationsSnapshotInitialized,
} from './singleton-operations';

const pendingLoads = new Map<Locale, Promise<void>>();

/**
 * Loads a locale into the global translations snapshot with the saved loader
 * settings, once, sharing a load in flight. Entries that arrive while it
 * loads, such as a provider's, are kept. A failed load leaves the locale out,
 * so the next call loads it again.
 */
export async function loadGlobalTranslationsSnapshot(
  locale: Locale
): Promise<void> {
  // A provider may publish part of a locale while it loads.
  if (
    !pendingLoads.has(locale) &&
    isGlobalTranslationsSnapshotInitialized() &&
    getGlobalTranslationsSnapshot()[locale]
  ) {
    return;
  }
  await dedupePending(pendingLoads, locale, async () =>
    fillGlobalTranslationsSnapshot(
      await loadTranslationsSnapshot(getTranslationsSnapshotLoader(), locale)
    )
  );
}
