import { I18nManager } from 'gt-i18n/internal';
import type {
  I18nManagerConstructorParams,
  TranslationsLoader,
} from 'gt-i18n/internal/types';
import type { BrowserStorageAdapter } from './BrowserStorageAdapter';
import type { HtmlTagOptions } from './utils/types';
import { determineLocale as gtDetermineLocale } from 'generaltranslation';
import { createInvalidLocaleWarning } from '../../shared/messages';
import { Translation } from 'gt-i18n/types';
import { DEFAULT_HTML_TAG_OPTIONS } from './utils/constants';
import { LocalStorageTranslationCache } from './LocalStorageTranslationCache';

/**
 * The configuration for the BrowserI18nManager
 */
type BrowserI18nManagerConstructorParams =
  I18nManagerConstructorParams<BrowserStorageAdapter> & {
    htmlTagOptions?: HtmlTagOptions;
  };

/**
 * I18nManager implementation for Browser.
 */
export class BrowserI18nManager extends I18nManager<
  BrowserStorageAdapter,
  Translation
> {
  /** Customize browser-related behavior */
  private htmlTagOptions?: HtmlTagOptions;

  /** Per-locale localStorage translation caches (dev mode only) */
  private _localStorageCaches!: Record<string, LocalStorageTranslationCache>;

  constructor(config: BrowserI18nManagerConstructorParams) {
    // Create the map before super() — can't access `this` yet.
    // The closure captures this object so the loader wrapper and
    // this._localStorageCaches share the same reference after assignment.
    const localStorageCaches: Record<string, LocalStorageTranslationCache> = {};

    if (import.meta.env.DEV && config.loadTranslations) {
      super({
        ...config,
        loadTranslations: wrapLoaderWithLocalStorage(
          config.loadTranslations,
          localStorageCaches
        ),
        onTranslationsCacheMiss: (_locale, _inputKey, hash, translation) => {
          const cache = localStorageCaches[_locale];
          if (cache) cache.write(hash, translation as Translation);
        },
      });
    } else {
      super(config);
    }

    this._localStorageCaches = localStorageCaches;
    this.storeAdapter.setConfig({
      defaultLocale: this.getDefaultLocale(),
      locales: this.getLocales(),
      customMapping: config.customMapping,
    });

    this.htmlTagOptions = {
      ...DEFAULT_HTML_TAG_OPTIONS,
      ...config.htmlTagOptions,
    };
  }

  /**
   * Returns the current locale
   * @returns {string} The current locale
   */
  getLocale(): string {
    return this.storeAdapter.getItem('locale') || this.config.defaultLocale;
  }

  /**
   * Set the locale
   * @param {string} locale - The locale to set
   * @returns {void}
   *
   * @note This function causes a page reload
   */
  setLocale(locale: string): void {
    if (!gtDetermineLocale(locale, this.getLocales())) {
      console.warn(createInvalidLocaleWarning(locale));
      return;
    }
    this.storeAdapter.setItem('locale', locale);
    window.location.reload();
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
    if (!import.meta.env.DEV) return undefined;

    if (!this._localStorageCaches[locale]) {
      this._localStorageCaches[locale] = new LocalStorageTranslationCache(
        locale,
        init
      );
    }
    return this._localStorageCaches[locale];
  }

  /**
   * Update the html tag (lang, dir)
   */
  updateHtmlTag(
    htmlTagOptions?: { lang?: string; dir?: 'ltr' | 'rtl' } & HtmlTagOptions
  ): void {
    // Get parameters
    const locale = htmlTagOptions?.lang || this.getLocale();
    const gtInstance = this.getGTClass();
    const canonicalLocale = gtInstance.resolveCanonicalLocale(locale);
    const localeDirection =
      htmlTagOptions?.dir || gtInstance.getLocaleDirection(locale);

    // Validate parameters
    if (!gtInstance.isValidLocale(canonicalLocale)) {
      console.warn(createInvalidLocaleWarning(locale));
      return;
    }

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
 */
function wrapLoaderWithLocalStorage(
  originalLoader: TranslationsLoader,
  localStorageCaches: Record<string, LocalStorageTranslationCache>
): TranslationsLoader {
  return async (locale: string) => {
    const loaderTranslations = await originalLoader(locale);
    localStorageCaches[locale] ||= new LocalStorageTranslationCache(
      locale,
      loaderTranslations as Record<string, Translation>
    );
    return localStorageCaches[locale].getInternalCache();
  };
}
