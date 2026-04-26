import { I18nManager } from 'gt-i18n/internal';
import type {
  I18nManagerConstructorParams,
  TranslationsLoader,
  LifecycleCallbacks,
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

  /** Whether dev hot reload JSX (Suspense-based <T>) is active */
  private _devHotReloadJsx = false;

  constructor(config: BrowserI18nManagerConstructorParams) {
    // Must be initialized  before super()
    const localStorageCaches: Record<string, LocalStorageTranslationCache> = {};
    const resolved = resolveDevHotReload(
      config.files?.gt?.parsingFlags?.devHotReload
    );

    // Initialize the I18nManager
    super({
      ...config,
      ...(isDevHotReloadEnabled(config) &&
        createDevHotReloadConfig(
          config.loadTranslations!,
          config.projectId!,
          localStorageCaches
        )),
    });

    this._localStorageCaches = localStorageCaches;
    this._devHotReloadJsx = isDevHotReloadEnabled(config) && resolved.jsx;
    this.storeAdapter.setConfig({
      defaultLocale: this.getDefaultLocale(),
      locales: this.getLocales(),
      customMapping: config.customMapping,
    });

    this.htmlTagOptions = {
      ...DEFAULT_HTML_TAG_OPTIONS,
      ...config.htmlTagOptions,
    };

    // For dev hot reload, we need to write the translations to the localStorage cache
    if (isDevHotReloadEnabled(config)) {
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
 * Creates the dev hot reload config
 */
function createDevHotReloadConfig(
  loadTranslations: TranslationsLoader,
  projectId: string,
  localStorageCaches: Record<string, LocalStorageTranslationCache>
): I18nManagerConstructorParams<BrowserStorageAdapter> {
  return {
    loadTranslations: wrapLoaderWithLocalStorage(
      loadTranslations,
      projectId,
      localStorageCaches
    ),
  };
}
/**
 * Wraps a translation loader to merge localStorage translations in dev mode.
 * On each call: runs the original loader, seeds a LocalStorageTranslationCache
 * with the result (loader wins over stale localStorage), and returns the merged
 * translations — preserving runtime tx() translations from previous sessions.
 */
function wrapLoaderWithLocalStorage(
  originalLoader: TranslationsLoader,
  projectId: string,
  localStorageCaches: Record<string, LocalStorageTranslationCache>
): TranslationsLoader {
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
 * Resolve the devHotReload config into { strings, jsx } flags.
 */
function resolveDevHotReload(
  value: boolean | { strings?: boolean; jsx?: boolean } | undefined
): { strings: boolean; jsx: boolean } {
  if (value === undefined || typeof value === 'boolean') {
    return { strings: !!value, jsx: !!value };
  }
  return { strings: value.strings ?? false, jsx: value.jsx ?? false };
}

/**
 * Determines if dev hot reload is enabled (any flag)
 * @param config - The configuration
 * @returns True if dev hot reload is enabled, false otherwise
 */
function isDevHotReloadEnabled(
  config: BrowserI18nManagerConstructorParams
): boolean {
  // TODO: this only works when you've defined a custom loadTranslations function
  // meaning CDN users will not have access to this feature
  const requirements: Record<string, boolean> = {
    environment: !!import.meta.env.DEV,
    customLoadTranslations: !!config.loadTranslations,
    projectId: !!config.projectId,
    devApiKey: !!config.devApiKey,
  };
  const requirementsMet = Object.values(requirements).every(Boolean);
  const resolved = resolveDevHotReload(
    config.files?.gt?.parsingFlags?.devHotReload
  );
  const anyEnabled = resolved.strings || resolved.jsx;
  // Only want this to log in development
  if (import.meta.env.DEV && anyEnabled && !requirementsMet) {
    const missingRequirements = Object.keys(requirements).filter(
      (key) => !requirements[key]
    );
    console.warn(
      `Dev hot reload is enabled, but the requirements are not met: ${missingRequirements.join(', ')}`
    );
  }
  return requirementsMet && anyEnabled;
}
