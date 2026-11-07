import { Locale } from 'gt-i18n/internal/types';
import { Dictionary } from 'gt-i18n/types';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { getI18nConfig } from '../../setup/i18nConfig';

/**
 * Serializable dictionaries for provider-less hydration: the requested locale
 * plus the default (source) locale, which dictionary lookups read source
 * entries from. In development, a locale whose load fails is left out of the
 * snapshot; in production the cache swallows the error and the locale gets an
 * empty dictionary. Either way its content renders untranslated.
 */
export async function getDictionariesSnapshot(
  locale: Locale
): Promise<Record<Locale, Dictionary>> {
  const i18nCache = getReactI18nCache();
  const defaultLocale = getI18nConfig().getDefaultLocale();
  // The default locale's source dictionary is set when the cache is created
  // and never goes through a loader, so only the requested locale can fail
  const snapshot: Record<Locale, Dictionary> = {
    [defaultLocale]: await i18nCache.loadDictionary(defaultLocale),
  };
  try {
    snapshot[locale] = await i18nCache.loadDictionary(locale);
  } catch (error) {
    console.warn(
      createDiagnosticMessage({
        source: '@generaltranslation/react-core',
        severity: 'Warning',
        whatHappened: `Could not load the dictionary for locale "${locale}", so dictionary content for this locale renders untranslated`,
        why: 'the dictionary loader failed',
        fix: 'Check your loadDictionary configuration.',
        details: formatDiagnosticErrorDetails(error),
      })
    );
  }
  return snapshot;
}
