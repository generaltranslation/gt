import type {
  I18nCacheConstructorParams,
  TranslationsLoader,
} from 'gt-i18n/internal/types';
import { getI18nConfig, I18nCache } from 'gt-i18n/internal';
import type { HtmlTagOptions } from './types';
import type { Translation } from 'gt-i18n/types';
import { DEFAULT_HTML_TAG_OPTIONS } from './constants';
import { createDiagnosticMessage } from 'generaltranslation/internal';

type LocalStorageTranslationCache =
  import('./LocalStorageTranslationCache').LocalStorageTranslationCache;
type LocalStorageCachePromises = Record<
  string,
  Promise<LocalStorageTranslationCache>
>;

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
  /** Customize browser-related behavior */
  private htmlTagOptions?: HtmlTagOptions;

  /** Whether dev hot reload JSX (Suspense-based <T>) is active */
  private _devHotReloadJsx = false;

  constructor(config: BrowserI18nCacheParams) {
    // Must be initialized before super()
    const { htmlTagOptions, ...managerConfig } = config;
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

    this.htmlTagOptions = {
      ...DEFAULT_HTML_TAG_OPTIONS,
      ...htmlTagOptions,
    };

    // For dev hot reload, we need to write the translations to the localStorage cache
    if (devHotReloadEnabled) {
      this.onTranslationsCacheMiss = ({ locale, hash, translation }) => {
        void getOrCreateLocalStorageCache(localStorageCaches, {
          locale,
          projectId,
          init: { [hash]: translation },
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

  /**
   * Update the html tag (lang, dir)
   *
   * @deprecated, TODO: we should use a different system for managing this html tag
   * this should just be for managing translations
   */
  updateHtmlTag(
    locale: string,
    htmlTagOptions?: { lang?: string; dir?: 'ltr' | 'rtl' } & HtmlTagOptions
  ): void {
    // Get parameters
    const htmlLocale = htmlTagOptions?.lang || locale;
    const i18nConfig = getI18nConfig();
    const canonicalLocale = i18nConfig.resolveCanonicalLocale(htmlLocale);

    // Validate parameters
    if (!i18nConfig.isValidLocale(canonicalLocale)) {
      console.warn(createInvalidLocaleWarning(htmlLocale));
      return;
    }

    const localeDirection =
      htmlTagOptions?.dir || i18nConfig.getLocaleDirection(canonicalLocale);

    // Merge options
    const mergedHtmlTagOptions = {
      ...this.htmlTagOptions,
      ...htmlTagOptions,
    };

    // Update html tag
    if (mergedHtmlTagOptions.updateHtmlLangTag) {
      document.documentElement.lang = canonicalLocale;
    }
    if (mergedHtmlTagOptions.updateHtmlDirTag) {
      document.documentElement.dir = localeDirection;
    }
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
  return (localStorageCaches[params.locale] ||= loadLocalStorageCache().then(
    ({ LocalStorageTranslationCache }) =>
      new LocalStorageTranslationCache(params)
  ));
}

function loadLocalStorageCache() {
  return (localStorageCacheModulePromise ??=
    import('./LocalStorageTranslationCache'));
}

const createInvalidLocaleWarning = (locale: string) =>
  createDiagnosticMessage({
    source: 'gt-react',
    severity: 'Warning',
    whatHappened: `Locale "${locale}" is not valid`,
    fix: 'Use a valid BCP 47 locale code or add a custom mapping',
  });
