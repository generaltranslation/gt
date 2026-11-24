import { Hash, Locale } from 'gt-i18n/internal';
import type { Content } from '@generaltranslation/format';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import {
  getGlobalTranslationsSnapshot,
  getTranslationsSnapshotLoader,
  isGlobalTranslationsSnapshotInitialized,
  isTranslationsSnapshotLoaderInitialized,
} from '../../translations-snapshot/singleton-operations';
import { loadTranslationsSnapshot } from '../../translations-snapshot/loadTranslationsSnapshot';

/**
 * Serializable cached translations for provider hydration; a failed load
 * yields a snapshot with no entry for the locale, so hydration caches nothing
 * and a later lookup retries. TODO: perhaps move to /i18n for type generics
 */
export async function getTranslationsSnapshot(
  locale: Locale
): Promise<Record<Locale, Record<Hash, Content>>> {
  // Production browser clients create no cache.
  if (
    process.env.NODE_ENV === 'production' &&
    isTranslationsSnapshotLoaderInitialized()
  ) {
    const loaded = isGlobalTranslationsSnapshotInitialized()
      ? getGlobalTranslationsSnapshot()[locale]
      : undefined;
    return loaded
      ? { [locale]: structuredClone(loaded) }
      : loadTranslationsSnapshot(getTranslationsSnapshotLoader(), locale);
  }
  const i18nCache = getReactI18nCache();
  try {
    return { [locale]: await i18nCache.loadTranslations(locale) };
  } catch (error) {
    console.warn(createLoadWarning(locale, error));
    return {};
  }
}

/**
 * Loads a locale's translations into the cache and copies nothing out, for a
 * caller that only waits for them. A failed load warns like
 * getTranslationsSnapshot, and a later lookup retries.
 */
export async function preloadTranslations(locale: Locale): Promise<void> {
  try {
    await getReactI18nCache().getLookupTranslation(locale);
  } catch (error) {
    console.warn(createLoadWarning(locale, error));
  }
}

function createLoadWarning(locale: Locale, error: unknown): string {
  return createDiagnosticMessage({
    source: '@generaltranslation/react-core',
    severity: 'Warning',
    whatHappened: `Could not load translations for locale "${locale}", so content for this locale renders untranslated`,
    why: 'the translation loader failed, usually because translations for this locale have not been generated yet',
    fix: 'Generate translations for this locale, or check your loadTranslations configuration.',
    details: formatDiagnosticErrorDetails(error),
  });
}
