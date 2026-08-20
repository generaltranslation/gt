import { Hash, Locale } from 'gt-i18n/internal/types';
import { Translation } from 'gt-i18n/types';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import { getReactI18nCache } from '../../i18n-cache/singleton-operations';

/**
 * Serializable cached translations for provider hydration; a failed load
 * degrades to an empty snapshot. TODO: perhaps move to /i18n for type generics
 */
export async function getTranslationsSnapshot(
  locale: Locale
): Promise<Record<Locale, Record<Hash, Translation>>> {
  const i18nCache = getReactI18nCache();
  try {
    // Only pass translations for the given locale to minimize the snapshot
    return { [locale]: await i18nCache.loadTranslations(locale) };
  } catch (error) {
    console.warn(
      createDiagnosticMessage({
        source: '@generaltranslation/react-core',
        severity: 'Warning',
        whatHappened: `Could not load translations for locale "${locale}", so content for this locale renders untranslated`,
        why: 'the translation loader failed, usually because translations for this locale have not been generated yet',
        fix: 'Generate translations for this locale, or check your loadTranslations configuration.',
        details: formatDiagnosticErrorDetails(error),
      })
    );
    return { [locale]: {} };
  }
}
