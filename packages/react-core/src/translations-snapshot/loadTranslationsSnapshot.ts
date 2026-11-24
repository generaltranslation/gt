import {
  getI18nConfig,
  getLoadTranslationsType,
  routeCreateTranslationLoader,
  type I18nCacheConstructorParams,
  type Locale,
} from 'gt-i18n/internal';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
import type { TranslationsSnapshot } from './singleton-operations';

export type TranslationsSnapshotLoaderParams = Pick<
  I18nCacheConstructorParams,
  'loadTranslations' | 'cacheUrl' | 'projectId' | '_versionId' | '_branchId'
>;

/**
 * Loads a locale's translations without going through the i18nCache, for
 * production clients that read only a translations snapshot. It picks the
 * loader as the i18nCache does. A failed load yields a snapshot with no entry
 * for the locale, so a later load retries.
 */
export async function loadTranslationsSnapshot(
  config: TranslationsSnapshotLoaderParams,
  locale: Locale
): Promise<TranslationsSnapshot> {
  if (locale === getI18nConfig().getDefaultLocale()) {
    return { [locale]: {} };
  }

  const loadTranslations = routeCreateTranslationLoader({
    loadTranslations: config.loadTranslations,
    type: getLoadTranslationsType(config),
    remoteTranslationLoaderParams: config,
  });

  try {
    // Lookups validate each entry, as they do the cache's.
    return {
      [locale]: (await loadTranslations(
        locale
      )) as TranslationsSnapshot[Locale],
    };
  } catch (error) {
    console.error(createLoadError(locale, error));
    return {};
  }
}

const createLoadError = (locale: Locale, error: unknown) =>
  createDiagnosticMessage({
    source: '@generaltranslation/react-core',
    severity: 'Error',
    whatHappened: `Could not load translations for locale "${locale}", so content for this locale renders untranslated`,
    why: 'the translation loader failed, usually because translations for this locale have not been generated yet',
    fix: 'Generate translations for this locale, or check your loadTranslations configuration.',
    details: formatDiagnosticErrorDetails(error),
  });
