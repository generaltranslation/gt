import { Hash, Locale } from 'gt-i18n/internal/types';
import { Translation } from 'gt-i18n/types';
import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { loadTranslationsSnapshot } from './loadTranslationsSnapshot';

/**
 * Serializable cached translations for provider hydration; a failed load
 * yields a snapshot with no entry for the locale, so hydration caches nothing
 * and a later lookup retries. TODO: perhaps move to /i18n for type generics
 */
export async function getTranslationsSnapshot(
  locale: Locale
): Promise<Record<Locale, Record<Hash, Translation>>> {
  const i18nCache = getReactI18nCache();
  return loadTranslationsSnapshot(locale, (locale) =>
    i18nCache.loadTranslations(locale)
  );
}
