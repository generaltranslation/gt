import { publishValidationResults } from './validation/publishValidationResults';
import logger from '../logs/logger';
import { TranslationsManager } from './translations-manager/TranslationsManager';
import { I18nManagerConfig, I18nManagerConstructorParams } from './types';
import { StorageAdapterType } from './storage-adapter/types';
import { validateConfig } from './validation/validateConfig';
import { Translations } from './translations-manager/utils/types/translation-data';
import { StorageAdapter } from './storage-adapter/StorageAdapter';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { GT, standardizeLocale } from 'generaltranslation';
import { CustomMapping } from 'generaltranslation/types';
import { InlineTranslationOptions } from '../translation-functions/types/options';
import { FallbackStorageAdapter } from './storage-adapter/FallbackStorageAdapter';
import { getGTServicesEnabled } from './utils/getGTServicesEnabled';
import { hashMessage } from '../utils/hashMessage';

/**
 * Class for managing translation functionality
 */
class I18nManager<T extends StorageAdapter = StorageAdapter> {
  private config: I18nManagerConfig;

  /**
   * Cache for translations
   */
  private translationsManager: TranslationsManager;

  /**
   * Store adapter
   */
  protected storeAdapter: T;

  /**
   * Creates an instance of I18nManager.
   * TODO: resolve gtConfig from just file path
   * @param params - The parameters for the I18nManager constructor
   * @param params.config - The configuration for the I18nManager
   */
  constructor(params: I18nManagerConstructorParams<T>) {
    // Validation
    const validationResults = validateConfig(params);
    publishValidationResults(validationResults, 'I18nManager: ');

    // Setup
    this.config = standardizeConfig(params);
    this.storeAdapter =
      (params.storeAdapter as T) ?? new FallbackStorageAdapter();
    this.translationsManager = new TranslationsManager(params);
  }

  // ========== Translations ========== //

  /**
   * Get the translations
   */
  async getTranslations(): Promise<Translations> {
    return this.translationsManager.getTranslations(this.getLocale());
  }

  // ========== Getters and Setters ========== //

  /**
   * Get adapter type
   */
  getAdapterType(): StorageAdapterType {
    return this.storeAdapter.type;
  }

  /**
   * Get the locale
   */
  getLocale(): string {
    const locale = this.storeAdapter.getItem('locale');
    if (!locale) {
      logger.warn(
        'getLocale() invoked outside of translation context, falling back to default locale'
      );
      return this.config.defaultLocale;
    }
    return locale;
  }

  /**
   * Set the locale
   */
  setLocale(locale: string): void {
    this.storeAdapter.setItem('locale', locale);
  }

  /**
   * Get the default locale
   */
  getDefaultLocale(): string {
    return this.config.defaultLocale;
  }

  /**
   * Get the locales
   */
  getLocales(): string[] {
    return this.config.locales;
  }

  /**
   * Get translation for a given locale and message
   *
   * @param {string} [locale] - The locale to get the translation for (if not provided, will use the current locale)
   * @returns A function that resolves the translations for a given message and options synchronously
   *
   * Note: we can assume that the translation is a string because we are passing a string
   */
  async getTranslationResolver(
    locale: string = this.getLocale()
  ): Promise<TranslationResolver> {
    // Early return if i18n is disabled or default locale
    if (
      this.config.enableI18n === false ||
      locale === this.config.defaultLocale
    ) {
      // return (message: string) => message;
      return (message: string) => {
        console.log(
          '[gt-i18n] getTranslationResolver(default locale): message:',
          message
        );
        return message;
      };
    }

    // Get translations
    const translations = await this.translationsManager.getTranslations(locale);

    // Create translation resolver
    return (message: string, options?: InlineTranslationOptions) => {
      // Calculate hash
      const hash = hashMessage(message, options);

      // Return translation or undefined
      const result = translations[hash] as unknown as string | undefined;
      console.log('[gt-i18n] getTranslationResolver: result:', result);
      return result;
    };
  }

  /**
   * Get a gt class instance
   * TODO: keep a cache to avoid creating new instances unnecessarily
   */
  getGTClass(): GT {
    return new GT({
      sourceLocale: this.config.defaultLocale,
      targetLocale: this.getLocale(),
      locales: this.config.locales,
      customMapping: this.config.customMapping,
      projectId: this.config.projectId,
      baseUrl: this.config.runtimeUrl || undefined,
      apiKey: this.config.apiKey,
      devApiKey: this.config.devApiKey,
    });
  }

  /**
   * Is translation enabled?
   */
  isTranslationEnabled(): boolean {
    return this.config.enableI18n;
  }

  // ========== Metadata ========== //

  /**
   * Returns true if translation is required
   * @param {string} [locale] - The user's locale
   * @returns {boolean} True if translation is required, otherwise false
   */
  requiresTranslation(locale: string = this.getLocale()): boolean {
    const defaultLocale = this.getDefaultLocale();
    const gt = this.getGTClass();
    const locales = this.getLocales();
    return (
      this.config.enableI18n &&
      gt.requiresTranslation(defaultLocale, locale, locales)
    );
  }

  /**
   * Returns true if dialect translation is required
   * @param {string} [locale] - The user's locale
   * @returns {boolean} True if dialect translation is required, otherwise false
   */
  requiresDialectTranslation(locale: string = this.getLocale()): boolean {
    const defaultLocale = this.getDefaultLocale();
    const gt = this.getGTClass();
    return (
      this.requiresTranslation(locale) &&
      gt.isSameLanguage(defaultLocale, locale)
    );
  }
}

export { I18nManager };

// ===== Helper Functions ===== //

/**
 * Standardize the config
 * @param config - The config to standardize
 * @returns The standardized config
 */
function standardizeConfig<T extends StorageAdapter>(
  config: I18nManagerConstructorParams<T>
): I18nManagerConfig {
  const gtServicesEnabled = getGTServicesEnabled(config);

  const dedupedLocales = dedupeLocales({
    defaultLocale: config.defaultLocale || libraryDefaultLocale,
    locales: config.locales || [libraryDefaultLocale],
    customMapping: config.customMapping,
  });

  return {
    enableI18n: config.enableI18n !== undefined ? config.enableI18n : true,
    projectId: config.projectId,
    devApiKey: config.devApiKey,
    apiKey: config.apiKey,
    runtimeUrl: config.runtimeUrl,
    ...(gtServicesEnabled
      ? standardizeLocales(dedupedLocales)
      : dedupedLocales),
  };
}

/**
 * Dedupe locales and add defaultLocale
 */
function dedupeLocales({
  defaultLocale,
  locales,
  customMapping,
}: {
  defaultLocale: string;
  locales: string[];
  customMapping?: CustomMapping;
}): {
  defaultLocale: string;
  locales: string[];
  customMapping: CustomMapping;
} {
  return {
    defaultLocale,
    locales: Array.from(new Set([defaultLocale, ...locales])),
    customMapping: customMapping || {},
  };
}

/**
 * Standardize all locales in config
 * Only apply if using GT services
 */
function standardizeLocales(config: {
  defaultLocale: string;
  locales: string[];
  customMapping: CustomMapping;
}): {
  defaultLocale: string;
  locales: string[];
  customMapping: CustomMapping;
} {
  // Sanitize defaultLocale and locales
  const defaultLocale = standardizeLocale(config.defaultLocale);
  const locales = config.locales.map((locale) => {
    const mappedLocale =
      typeof config.customMapping?.[locale] === 'string'
        ? config.customMapping?.[locale]
        : config.customMapping?.[locale]?.code;
    if (mappedLocale) {
      return locale;
    } else {
      return standardizeLocale(locale);
    }
  });

  // Sanitize customMapping
  const customMapping = Object.fromEntries(
    Object.entries(config.customMapping || {}).map(([key, value]) => [
      key,
      typeof value === 'string'
        ? standardizeLocale(value)
        : {
            ...value,
            ...(value.code ? { code: standardizeLocale(value.code) } : {}),
          },
    ])
  );

  return {
    defaultLocale,
    locales,
    customMapping,
  };
}

/**
 * Type definition for a synchronous translation resolver function
 * @param {string} message - The message to get the translation for
 * @param {InlineTranslationOptions} [options] - The options for the translation
 * @returns {string | undefined} The translation for the given message and options
 */
type TranslationResolver = (
  message: string,
  options?: InlineTranslationOptions
) => string | undefined;
