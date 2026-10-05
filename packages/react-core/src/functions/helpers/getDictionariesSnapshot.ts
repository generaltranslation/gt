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
 * entries from. A locale whose load fails is left out of the snapshot, so its
 * content renders untranslated.
 */
export async function getDictionariesSnapshot(
  locale: Locale
): Promise<Record<Locale, Dictionary>> {
  const i18nCache = getReactI18nCache();
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const locales = locale === defaultLocale ? [locale] : [locale, defaultLocale];

  const results = await Promise.allSettled(
    locales.map((l) => i18nCache.loadDictionary(l))
  );

  const snapshot: Record<Locale, Dictionary> = {};
  results.forEach((result, index) => {
    const resultLocale = locales[index];
    if (result.status === 'fulfilled') {
      snapshot[resultLocale] = result.value;
      return;
    }
    console.warn(
      createDiagnosticMessage({
        source: '@generaltranslation/react-core',
        severity: 'Warning',
        whatHappened: `Could not load the dictionary for locale "${resultLocale}", so dictionary content for this locale renders untranslated`,
        why: 'the dictionary loader failed',
        fix: 'Check your loadDictionary configuration.',
        details: formatDiagnosticErrorDetails(result.reason),
      })
    );
  });
  return snapshot;
}
