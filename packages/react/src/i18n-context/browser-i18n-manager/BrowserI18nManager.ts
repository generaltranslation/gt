import { I18nManager } from 'gt-i18n/internal';
import type {
  I18nManagerConstructorParams,
  TranslationsLoader,
} from 'gt-i18n/internal/types';
import type { HtmlTagOptions } from './utils/types';
import type { Translation } from 'gt-i18n/types';
import { DEFAULT_HTML_TAG_OPTIONS } from './utils/constants';
import { LocalStorageTranslationCache } from './LocalStorageTranslationCache';
import { createInvalidLocaleWarning } from '../../shared/messages';

/**
 * The configuration for the BrowserI18nManager
 */
type BrowserI18nManagerConstructorParams =
  I18nManagerConstructorParams<Translation> & {
    htmlTagOptions?: HtmlTagOptions;
  };

/**
 * I18nManager implementation for Browser.
 */
export class BrowserI18nManager extends I18nManager<Translation> {
  /** Customize browser-related behavior */
  private htmlTagOptions?: HtmlTagOptions;

  /** Per-locale localStorage translation caches (dev mode only) */
  private _localStorageCaches!: Record<string, LocalStorageTranslationCache>;

  /** Whether dev hot reload JSX (Suspense-based <T>) is active */
  private _devHotReloadJsx = false;

  constructor(config: BrowserI18nManagerConstructorParams) {
    // Must be initialized before super()
    const { htmlTagOptions, ...managerConfig } = config;
    const localStorageCaches: Record<string, LocalStorageTranslationCache> = {};
    const resolved = resolveDevHotReload(
      config.files?.gt?.parsingFlags?.devHotReload
    );
    const devHotReloadEnabled = isDevHotReloadEnabled(config);
    const loadTranslations = devHotReloadEnabled
      ? wrapLoaderWithLocalStorage(
          config.loadTranslations!,
          config.projectId!,
          localStorageCaches
        )
      : config.loadTranslations;

    // Initialize the I18nManager
    super({
      ...managerConfig,
      loadTranslations,
    });

    this._localStorageCaches = localStorageCaches;
    this._devHotReloadJsx = devHotReloadEnabled && resolved.jsx;

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
    locale: string,
    htmlTagOptions?: { lang?: string; dir?: 'ltr' | 'rtl' } & HtmlTagOptions
  ): void {
    // Get parameters
    const htmlLocale = htmlTagOptions?.lang || locale;
    const gtInstance = this.getGTClass();
    const canonicalLocale = gtInstance.resolveCanonicalLocale(htmlLocale);

    // Validate parameters
    if (!gtInstance.isValidLocale(canonicalLocale)) {
      console.warn(createInvalidLocaleWarning(htmlLocale));
      return;
    }

    const localeDirection =
      htmlTagOptions?.dir || gtInstance.getLocaleDirection(canonicalLocale);

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
 * Resolve the devHotReload config into { strings, jsx } flags.
 */
function resolveDevHotReload(
  value: boolean | { strings?: boolean; jsx?: boolean } | undefined
) {
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
function isDevHotReloadEnabled(config: BrowserI18nManagerConstructorParams) {
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
