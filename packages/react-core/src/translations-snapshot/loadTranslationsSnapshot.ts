import {
  createRemoteTranslationLoader,
  getI18nConfig,
  getLoadTranslationsType,
  LoadTranslationsType,
  type I18nCacheConstructorParams,
  type Locale,
  type TranslationsLoader,
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

  const loadTranslations = getTranslationsLoader(config);
  if (!loadTranslations) {
    return { [locale]: {} };
  }

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

/**
 * Picks the translation loader with the i18nCache's rule, warning when the
 * config cannot load translations. Returns undefined when nothing should be
 * loaded.
 */
function getTranslationsLoader(
  config: TranslationsSnapshotLoaderParams
): TranslationsLoader | undefined {
  const { loadTranslations, cacheUrl, projectId, _versionId, _branchId } =
    config;
  switch (getLoadTranslationsType(config)) {
    case LoadTranslationsType.CUSTOM:
      return loadTranslations;
    case LoadTranslationsType.GT_REMOTE:
    case LoadTranslationsType.REMOTE:
      if (!projectId) {
        console.warn(noRemoteStoreProjectIdWarning);
        return undefined;
      }
      return createRemoteTranslationLoader({
        cacheUrl: cacheUrl ?? undefined,
        projectId,
        _versionId,
        _branchId,
        customMapping: getI18nConfig().getCustomMapping(),
      });
    case LoadTranslationsType.DISABLED:
      // cacheUrl: null is an explicit opt-out of translation loading
      if (cacheUrl !== null) console.warn(noTranslationLoaderWarning);
      return undefined;
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

const noRemoteStoreProjectIdWarning = createDiagnosticMessage({
  source: '@generaltranslation/react-core',
  severity: 'Warning',
  whatHappened:
    'Loading translations from a remote store needs a projectId, so no translations will be loaded',
  fix: 'Add projectId to your GT config, or set cacheUrl to null to disable translation loading.',
});

const noTranslationLoaderWarning = createDiagnosticMessage({
  source: '@generaltranslation/react-core',
  severity: 'Warning',
  whatHappened:
    'No translation loader was found, so no translations will be loaded',
  fix: 'Add projectId to your GT config (to load from the GT remote store), provide a loadTranslations function, or set cacheUrl to null to disable translation loading.',
});
