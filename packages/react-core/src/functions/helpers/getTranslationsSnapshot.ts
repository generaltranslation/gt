import { Hash, Locale } from 'gt-i18n/internal/types';
import { Translation } from 'gt-i18n/types';
import { getReactI18nManager } from '../../i18n-manager/singleton-operations';

/**
 * Returns a promise of serializable cached translations that
 * can be passed to a provider for hydration
 *
 * TODO: perhaps should be moved to /i18n if allowing for type generics
 */
export async function getTranslationsSnapshot(
  locale: Locale
): Promise<Record<Locale, Record<Hash, Translation>>> {
  const i18nManager = getReactI18nManager();
  const translations = await i18nManager.loadTranslations(locale);
  // Only pass translations for the given locale to minimize the size of the snapshot
  return { [locale]: translations };
}
