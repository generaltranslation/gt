import type { Hash, Locale } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';

type LoadTranslations = (locale: Locale) => Promise<Record<Hash, Translation>>;

export async function loadTranslationsSnapshot(
  locale: Locale,
  loadTranslations: LoadTranslations
): Promise<Record<Locale, Record<Hash, Translation>>> {
  try {
    return { [locale]: await loadTranslations(locale) };
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
    return {};
  }
}
