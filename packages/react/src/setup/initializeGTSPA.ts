import {
  getTranslationsSnapshot,
  I18nStore,
  setI18nStore,
  setReactI18nCache,
  getReadonlyConditionStore,
  getI18nConfig,
  initializeI18nConfig,
  setGlobalTranslationsSnapshot,
  getDictionariesSnapshot,
  setGlobalDictionariesSnapshot,
  type TranslationsSnapshot,
  type DictionariesSnapshot,
} from '@generaltranslation/react-core/pure';
import type { I18nConfigParams } from '@generaltranslation/react-core/pure';
import { createRemoteTranslationLoader } from 'gt-i18n/internal';
import type { Locale } from 'gt-i18n/internal/types';
import {
  createDiagnosticMessage,
  defaultCacheUrl,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
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
 * - i18nCache
 * - conditionStore
 * - i18nStore (development only)
 * - translationsSnapshot
 * - dictionariesSnapshot
 *
 * This is SPA for browser runtime
 *
 * Call once per page load. The snapshots keep their first value, so calling
 * this again does not reload translations; changing locale reloads the page.
 */
export async function initializeGTSPA(config: InitializeGTSPAParams) {
  const runtimeConfig = addRuntimeCredentials(config);
  initializeI18nConfig(runtimeConfig, 'SPA');

  if (process.env.NODE_ENV !== 'production') {
    const i18nCache = new BrowserI18nCache(runtimeConfig);
    setReactI18nCache(i18nCache);
  }

  createOrUpdateBrowserConditionStore(runtimeConfig);

  // Dev hot reload only: production lookups read the snapshots
  if (process.env.NODE_ENV !== 'production') {
    setI18nStore(new I18nStore());
  }

  // Block until translations and dictionaries are loaded
  const locale = getReadonlyConditionStore().getLocale();
  const [translationsSnapshot, dictionariesSnapshot] = await Promise.all([
    // Production loads directly; dev loads through the cache, which dev hot
    // reload reads from and updates
    process.env.NODE_ENV === 'production'
      ? loadTranslationsSnapshot(runtimeConfig, locale)
      : getTranslationsSnapshot(locale),
    process.env.NODE_ENV === 'production'
      ? loadDictionariesSnapshot(runtimeConfig, locale)
      : getDictionariesSnapshot(locale),
  ]);
  setGlobalTranslationsSnapshot(translationsSnapshot);
  setGlobalDictionariesSnapshot(dictionariesSnapshot);
}

/**
 * Loads the translations snapshot without going through the i18nCache.
 * A failed load yields a snapshot with no entry for the locale.
 */
async function loadTranslationsSnapshot(
  config: InitializeGTSPAParams,
  locale: Locale
): Promise<TranslationsSnapshot> {
  // Source content needs no translations
  if (!getI18nConfig().requiresTranslation(locale)) {
    return { [locale]: {} };
  }

  const loadTranslations = getTranslationsLoader(config);
  if (!loadTranslations) {
    return { [locale]: {} };
  }

  try {
    return {
      [locale]: await loadTranslations(locale),
    } as TranslationsSnapshot;
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
    return {};
  }
}

type TranslationsLoader = NonNullable<
  InitializeGTSPAParams['loadTranslations']
>;

/**
 * Picks the translation loader the same way the i18nCache does, warning when
 * the config cannot load translations. Returns undefined when nothing should
 * be loaded.
 */
function getTranslationsLoader(
  config: InitializeGTSPAParams
): TranslationsLoader | undefined {
  const { cacheUrl, projectId } = config;
  if (config.loadTranslations) {
    return config.loadTranslations;
  }
  // GT remote store
  if ((cacheUrl === undefined || cacheUrl === defaultCacheUrl) && projectId) {
    return createRemoteTranslationLoader({
      ...config,
      cacheUrl: defaultCacheUrl,
      projectId,
      customMapping: getI18nConfig().getCustomMapping(),
    });
  }
  // Custom remote store
  if (cacheUrl) {
    if (!projectId) {
      console.warn(
        createDiagnosticMessage({
          source: 'gt-react',
          severity: 'Warning',
          whatHappened:
            'Loading translations from a remote store needs a projectId, so no translations will be loaded',
          fix: 'Add projectId to the initializeGTSPA config, or set cacheUrl to null to disable translation loading.',
        })
      );
      return undefined;
    }
    return createRemoteTranslationLoader({
      ...config,
      cacheUrl,
      projectId,
      customMapping: getI18nConfig().getCustomMapping(),
    });
  }
  // cacheUrl: null is an explicit opt-out of translation loading
  if (cacheUrl !== null) {
    console.warn(
      createDiagnosticMessage({
        source: 'gt-react',
        severity: 'Warning',
        whatHappened:
          'No translation loader was found, so no translations will be loaded',
        fix: 'Add projectId to the initializeGTSPA config (to load from the GT remote store), provide a loadTranslations function, or set cacheUrl to null to disable translation loading.',
      })
    );
  }
  return undefined;
}

/**
 * Loads the dictionaries snapshot without going through the i18nCache: the
 * requested locale plus the default (source) locale, which dictionary lookups
 * read source entries from. A failed load leaves the requested locale out.
 */
async function loadDictionariesSnapshot(
  config: InitializeGTSPAParams,
  locale: Locale
): Promise<DictionariesSnapshot> {
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const sourceDictionary = config.dictionary ?? {};
  const snapshot: DictionariesSnapshot = { [defaultLocale]: sourceDictionary };

  // Source content uses the source dictionary
  if (!getI18nConfig().requiresTranslation(locale)) {
    return { ...snapshot, [locale]: sourceDictionary };
  }

  try {
    snapshot[locale] = config.loadDictionary
      ? ((await config.loadDictionary(locale)) ?? {})
      : {};
  } catch (error) {
    console.error(
      createDiagnosticMessage({
        source: 'gt-react',
        severity: 'Error',
        whatHappened: `Could not load the dictionary for locale "${locale}", so dictionary content for this locale renders untranslated`,
        why: 'the dictionary loader failed',
        fix: 'Check your loadDictionary configuration.',
        details: formatDiagnosticErrorDetails(error),
      })
    );
  }
  return snapshot;
}
