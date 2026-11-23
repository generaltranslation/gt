import {
  preloadTranslations,
  I18nStore,
  setI18nStore,
  setReactI18nCache,
  getReadonlyConditionStore,
  getI18nConfig,
  initializeI18nConfig,
  setGlobalTranslationsSnapshot,
  type TranslationsSnapshot,
} from '@generaltranslation/react-core/pure';
import type { I18nConfigParams } from '@generaltranslation/react-core/pure';
import {
  createRemoteTranslationLoader,
  type TranslationsLoader,
} from 'gt-i18n/internal';
import type { Locale } from 'gt-i18n/internal';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
import { defaultCacheUrl } from 'generaltranslation/internal';
import { BrowserI18nCache } from '../i18n-cache/BrowserI18nCache';
import type { BrowserI18nCacheParams } from '../i18n-cache/BrowserI18nCache';
import {
  createOrUpdateBrowserConditionStore,
  CreateBrowserConditionStoreParams,
} from '../condition-store/createBrowserConditionStore';
import { addRuntimeCredentials } from './runtimeCredentials';

export type InitializeGTSPAParams = I18nConfigParams &
  BrowserI18nCacheParams &
  CreateBrowserConditionStoreParams;

/**
 * Initialize GT for an SPA
 * - conditionStore
 * - translationsSnapshot (production)
 * - i18nCache and i18nStore (development only)
 *
 * This is SPA for browser runtime
 *
 * Call once per page load. The snapshot keeps its first value, so calling
 * this again does not reload translations; changing locale reloads the page.
 * Translations never expire in the browser, so `cacheExpiryTime` is ignored.
 */
export async function initializeGTSPA(config: InitializeGTSPAParams) {
  const runtimeConfig = addRuntimeCredentials(config);
  initializeI18nConfig(runtimeConfig, 'SPA');

  createOrUpdateBrowserConditionStore(runtimeConfig);
  const locale = getReadonlyConditionStore().getLocale();

  // Production lookups read the snapshot, so it skips the cache and store
  if (process.env.NODE_ENV === 'production') {
    setGlobalTranslationsSnapshot(
      await loadTranslationsSnapshot(runtimeConfig, locale)
    );
    return;
  }

  // Dev hot reload reads from and updates the cache through the store
  setReactI18nCache(
    new BrowserI18nCache({
      ...runtimeConfig,
      // Lookups are synchronous, so an expired locale would render untranslated.
      cacheExpiryTime: null,
    })
  );
  setI18nStore(new I18nStore());

  // Block until translations are loaded
  await preloadTranslations(locale);
}

/**
 * Loads the translations snapshot without going through the i18nCache.
 * A failed load yields a snapshot with an empty entry for the locale.
 */
async function loadTranslationsSnapshot(
  config: InitializeGTSPAParams,
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
    console.error(
      createDiagnosticMessage({
        source: 'gt-react',
        severity: 'Error',
        whatHappened: `Could not load translations for locale "${locale}", so content for this locale renders untranslated`,
        why: 'the translation loader failed, usually because translations for this locale have not been generated yet',
        fix: 'Generate translations for this locale, or check your loadTranslations configuration.',
        details: formatDiagnosticErrorDetails(error),
      })
    );
    return { [locale]: {} };
  }
}

/**
 * Picks the translation loader the same way the i18nCache does, warning when
 * the config cannot load translations. Returns undefined when nothing should
 * be loaded.
 */
function getTranslationsLoader(
  config: InitializeGTSPAParams
): TranslationsLoader | undefined {
  const { cacheUrl, projectId, _versionId, _branchId } = config;
  if (config.loadTranslations) {
    return config.loadTranslations;
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

const noRemoteStoreProjectIdWarning = createDiagnosticMessage({
  source: 'gt-react',
  severity: 'Warning',
  whatHappened:
    'Loading translations from a remote store needs a projectId, so no translations will be loaded',
  fix: 'Add projectId to the initializeGTSPA config, or set cacheUrl to null to disable translation loading.',
});

const noTranslationLoaderWarning = createDiagnosticMessage({
  source: 'gt-react',
  severity: 'Warning',
  whatHappened:
    'No translation loader was found, so no translations will be loaded',
  fix: 'Add projectId to the initializeGTSPA config (to load from the GT remote store), provide a loadTranslations function, or set cacheUrl to null to disable translation loading.',
});
