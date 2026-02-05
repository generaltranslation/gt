import { publishValidationResults } from './validation/publishValidationResults';
import logger from '../logs/logger';
import { TranslationsManager } from './translations-manager/TranslationsManager';
import { I18nManagerConfig, I18nManagerConstructorParams } from './types';
import { validateConfig } from './validation/validateConfig';
import { Translations } from './translations-manager/utils/types/translation-data';
import { StorageAdapter } from './storage-adapter/StorageAdapter';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { GT, standardizeLocale } from 'generaltranslation';
import { CustomMapping } from 'generaltranslation/types';
import { InlineTranslationOptions } from '../translation-functions/types';
import { FallbackStorageAdapter } from './storage-adapter/FallbackStorageAdapter';
import { getGTServicesEnabled } from './utils/getGTServicesEnabled';
import { hashMessage } from '../utils/hashMessage';

/**
 * Class for managing translation functionality
 */
class I18nManager {
  private config: I18nManagerConfig;

  /**
   * Cache for translations
   */
  private translationsManager: TranslationsManager;

  /**
   * Store adapter
   */
  protected storeAdapter: StorageAdapter = new FallbackStorageAdapter();

  /**
   * Creates an instance of I18nManager.
   * TODO: resolve gtConfig from just file path
   * @param params - The parameters for the I18nManager constructor
   * @param params.config - The configuration for the I18nManager
   */
  constructor(params: I18nManagerConstructorParams) {
    // Validation
    const validationResults = validateConfig(params);
    publishValidationResults(validationResults, 'I18nManager:');

    // Setup
    this.config = standardizeConfig(params);
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
   * @param message - The message to get the translation for
   * @param options - The options for the translation
   * @returns The translation for the given locale and message
   *
   * Note: we can assume that the translation is a string because we are passing a string
   */
  async getTranslation(
    message: string,
    options: InlineTranslationOptions
  ): Promise<string | undefined> {
    // Get translations
    const translations = await this.translationsManager.getTranslations(
      this.getLocale()
    );

    // Calculate hash
    const hash = hashMessage(message, options);

    // Return translation or undefined
    return translations[hash] as unknown as string | undefined;
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
}

export { I18nManager };

// ===== Helper Functions ===== //

/**
 * Standardize the config
 * @param config - The config to standardize
 * @returns The standardized config
 */
function standardizeConfig(
  config: I18nManagerConstructorParams
): I18nManagerConfig {
  const gtServicesEnabled = getGTServicesEnabled(config);

  const dedupedLocales = dedupeLocales({
    defaultLocale: config.defaultLocale || libraryDefaultLocale,
    locales: config.locales || [libraryDefaultLocale],
    customMapping: config.customMapping,
  });

  if (gtServicesEnabled) {
    return {
      enableI18n: config.enableI18n !== undefined ? config.enableI18n : true,
      ...standardizeLocales(dedupedLocales),
    };
  }

  return {
    enableI18n: false,
    ...dedupedLocales,
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
