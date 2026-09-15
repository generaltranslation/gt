import type {
  I18nCacheConstructorParams,
  TranslationsLoader,
} from 'gt-i18n/internal/types';
import { getI18nConfig, I18nCache } from 'gt-i18n/internal';
import type { HtmlTagOptions } from './types';
import type { Translation } from 'gt-i18n/types';

type LocalStorageTranslationCache =
  import('./LocalStorageTranslationCache').LocalStorageTranslationCache;
type LocalStorageCachePromises = Record<
  string,
  Promise<LocalStorageTranslationCache>
>;

// Lazily import the development-only cache so bundlers can keep it out of the initial client chunk.
// `??=` saves the first import promise, so all cache instances reuse the same lazy module load.
let localStorageCacheModulePromise:
  | Promise<typeof import('./LocalStorageTranslationCache')>
  | undefined;

/**
 * The configuration for the BrowserI18nCache
 */
export type BrowserI18nCacheParams = I18nCacheConstructorParams & {
  htmlTagOptions?: HtmlTagOptions;
};

/**
 * I18nCache implementation for Browser.
 */
export class BrowserI18nCache extends I18nCache<Translation> {
  /** Whether dev hot reload JSX (Suspense-based <T>) is active */
  private _devHotReloadJsx = false;

  constructor(config: BrowserI18nCacheParams) {
    // Must be initialized before super()
    // Keep accepting htmlTagOptions without passing it to the translation cache.
    const { htmlTagOptions: _htmlTagOptions, ...managerConfig } = config;
    const localStorageCaches: LocalStorageCachePromises = {};
    const i18nConfig = getI18nConfig();
    const devHotReloadEnabled =
      !!config.loadTranslations && i18nConfig.isDevHotReloadEnabled();
    const projectId = i18nConfig.getProjectId()!;
    const loadTranslations = devHotReloadEnabled
      ? wrapLoaderWithLocalStorage(
          config.loadTranslations!,
          projectId,
          localStorageCaches
        )
      : config.loadTranslations;

    // Initialize the I18nCache
    super({
      ...managerConfig,
      loadTranslations,
    });

    this._devHotReloadJsx = devHotReloadEnabled;

    // For dev hot reload, we need to write the translations to the localStorage cache
    if (devHotReloadEnabled) {
      this.onTranslationsCacheMiss = ({ locale, hash, translation }) => {
        void getOrCreateLocalStorageCache(localStorageCaches, {
          locale,
          projectId,
        }).then((cache) => cache.write(hash, translation));
      };
    }
  }

  /**
   * Whether dev hot reload JSX (Suspense-based <T>) is active
   */
  isDevHotReloadJsx(): boolean {
    return this._devHotReloadJsx;
  }
}

// ===== Helper Functions ===== //

/**
 * Wraps a translation loader to merge localStorage translations in dev mode.
 * On each call: runs the original loader, seeds a LocalStorageTranslationCache
 * with the result (loader wins over stale localStorage), and returns the merged
 * translations — preserving runtime tx() translations from previous sessions.
 *
 * TODO: this should be moved to wrapping in I18nStore
 */
function wrapLoaderWithLocalStorage(
  originalLoader: TranslationsLoader,
  projectId: string,
  localStorageCaches: LocalStorageCachePromises
) {
  return async (locale: string) => {
    const loaderTranslations = await originalLoader(locale);
    const cache = await getOrCreateLocalStorageCache(localStorageCaches, {
      locale,
      projectId,
      init: loaderTranslations as Record<string, Translation>,
    });
    return cache.getInternalCache();
  };
}
function getOrCreateLocalStorageCache(
  localStorageCaches: LocalStorageCachePromises,
  params: {
    locale: string;
    projectId: string;
    init?: Record<string, Translation>;
  }
): Promise<LocalStorageTranslationCache> {
  // `||=` saves the first promise for this locale, so concurrent calls reuse one cache instance.
  return (localStorageCaches[params.locale] ||= loadLocalStorageCache().then(
    ({ LocalStorageTranslationCache }) =>
      new LocalStorageTranslationCache(params)
  ));
}

function loadLocalStorageCache() {
  return (localStorageCacheModulePromise ??=
    import('./LocalStorageTranslationCache'));
}
