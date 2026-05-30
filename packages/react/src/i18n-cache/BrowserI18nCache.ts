import type {
  I18nCacheConstructorParams,
  TranslationsLoader,
} from 'gt-i18n/internal/types';
import { getI18nConfig, I18nCache } from 'gt-i18n/internal';
import type { HtmlTagOptions } from './types';
import type { Translation } from 'gt-i18n/types';
import { DEFAULT_HTML_TAG_OPTIONS } from './constants';
import { LocalStorageTranslationCache } from './LocalStorageTranslationCache';
import { createDiagnosticMessage } from 'generaltranslation/internal';

/**
 * The configuration for the BrowserI18nCache
 */
export type BrowserI18nCacheParams = I18nCacheConstructorParams<Translation> & {
  htmlTagOptions?: HtmlTagOptions;
};

/**
 * I18nCache implementation for Browser.
 */
export class BrowserI18nCache extends I18nCache<Translation> {
  /** Customize browser-related behavior */
  private htmlTagOptions?: HtmlTagOptions;

  /** Per-locale localStorage translation caches (dev mode only) */
  private _localStorageCaches!: Record<string, LocalStorageTranslationCache>;

  /** Whether dev hot reload JSX (Suspense-based <T>) is active */
  private _devHotReloadJsx = false;

  constructor(config: BrowserI18nCacheParams) {
    // Must be initialized before super()
    const { htmlTagOptions, ...managerConfig } = config;
    const localStorageCaches: Record<string, LocalStorageTranslationCache> = {};
    const devHotReloadEnabled = isDevHotReloadEnabled(config);
    const loadTranslations = devHotReloadEnabled
      ? wrapLoaderWithLocalStorage(
          config.loadTranslations!,
          config.projectId!,
          localStorageCaches
        )
      : config.loadTranslations;

    // Initialize the I18nCache
    super({
      ...managerConfig,
      loadTranslations,
    });

    this._localStorageCaches = localStorageCaches;
    this._devHotReloadJsx = devHotReloadEnabled;

    this.htmlTagOptions = {
      ...DEFAULT_HTML_TAG_OPTIONS,
      ...htmlTagOptions,
    };

    // For dev hot reload, we need to write the translations to the localStorage cache
    if (devHotReloadEnabled) {
      this.subscribe(
        'translations-cache-miss',
        ({ locale, hash, translation }) => {
          const cache = localStorageCaches[locale];
          if (cache) {
            cache.write(hash, translation);
          } else {
            localStorageCaches[locale] = new LocalStorageTranslationCache({
              locale,
              projectId: this.config.projectId!,
              init: { [hash]: translation },
            });
          }
        }
      );
    }
  }

  /**
   * Whether dev hot reload JSX (Suspense-based <T>) is active
   */
  isDevHotReloadJsx(): boolean {
    return this._devHotReloadJsx;
  }

  /**
   * Get or create a LocalStorageTranslationCache for the given locale.
   * Instances are lazily created and cached per locale.
   * Returns undefined if not in development mode.
   */
  getLocalStorageTranslationCache(
    locale: string,
    init?: Record<string, Translation>
  ): LocalStorageTranslationCache | undefined {
    if (!import.meta.env?.DEV) return undefined;

    if (!this._localStorageCaches[locale]) {
      this._localStorageCaches[locale] = new LocalStorageTranslationCache({
        locale,
        projectId: this.config.projectId!,
        init,
      });
    }
    return this._localStorageCaches[locale];
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
  localStorageCaches: Record<string, LocalStorageTranslationCache>
) {
  return async (locale: string) => {
    const loaderTranslations = await originalLoader(locale);
    localStorageCaches[locale] ||= new LocalStorageTranslationCache({
      locale,
      projectId,
      init: loaderTranslations as Record<string, Translation>,
    });
    return localStorageCaches[locale].getInternalCache();
  };
}

/**
 * Determines if dev hot reload is enabled (any flag)
 * @param config - The configuration
 * @returns True if dev hot reload is enabled, false otherwise
 *
 * @deprecated move this to i18nConfig
 */
function isDevHotReloadEnabled(config: BrowserI18nCacheParams) {
  // TODO: this only works when you've defined a custom loadTranslations function
  // meaning CDN users will not have access to this feature
  return !!(
    import.meta.env?.DEV &&
    config.loadTranslations &&
    config.projectId &&
    config.devApiKey
  );
}

const createInvalidLocaleWarning = (locale: string) =>
  createDiagnosticMessage({
    source: 'gt-react',
    severity: 'Warning',
    whatHappened: `Locale "${locale}" is not valid`,
    fix: 'Use a valid BCP 47 locale code or add a custom mapping',
  });
