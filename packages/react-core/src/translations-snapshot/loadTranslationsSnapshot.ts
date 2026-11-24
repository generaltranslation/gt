import {
  createRemoteTranslationLoader,
  getI18nConfig,
  type I18nCacheConstructorParams,
  type Locale,
  type TranslationsLoader,
} from 'gt-i18n/internal';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
import { defaultCacheUrl } from 'generaltranslation/internal';
import type { TranslationsSnapshot } from './singleton-operations';

export type TranslationsSnapshotLoaderParams = Pick<
  I18nCacheConstructorParams,
  'loadTranslations' | 'cacheUrl' | 'projectId' | '_versionId' | '_branchId'
>;

/**
 * Loads a locale's translations without going through the i18nCache, for
 * production clients that read only a translations snapshot. A failed load
 * yields a snapshot with an empty entry for the locale.
 */
export async function loadTranslationsSnapshot(
  config: TranslationsSnapshotLoaderParams,
  locale: Locale
): Promise<TranslationsSnapshot> {
  // Source content needs no translations
  if (!getI18nConfig().requiresTranslation({ locale })) {
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
    return { [locale]: {} };
  }
}

/**
 * Picks the translation loader the same way the i18nCache does, warning when
 * the config cannot load translations. Returns undefined when nothing should
 * be loaded.
 */
function getTranslationsLoader({
  loadTranslations,
  cacheUrl,
  projectId,
  _versionId,
  _branchId,
}: TranslationsSnapshotLoaderParams): TranslationsLoader | undefined {
  if (loadTranslations) {
    return loadTranslations;
  }
  if (cacheUrl === null) {
    // cacheUrl: null is an explicit opt-out of translation loading
    return undefined;
  }
  if (!projectId) {
    console.warn(
      cacheUrl === undefined || cacheUrl === defaultCacheUrl
        ? noTranslationLoaderWarning
        : noRemoteStoreProjectIdWarning
    );
    return undefined;
  }
  return createRemoteTranslationLoader({
    cacheUrl: cacheUrl ?? defaultCacheUrl,
    projectId,
    _versionId,
    _branchId,
    customMapping: getI18nConfig().getCustomMapping(),
  });
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
