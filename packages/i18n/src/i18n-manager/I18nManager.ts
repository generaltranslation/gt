import { publishValidationResults } from './validation/publishValidationResults';
import { TranslationsManager } from './translations-manager/TranslationsManager';
import { I18nManagerConfig, I18nManagerConstructorParams } from './types';
import { validateConfig } from './validation/validateConfig';
import { Translations } from './translations-manager/utils/types/translation-data';
import StorageAdapter from './storage-adapter/StorageAdapter';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { GT, standardizeLocale } from 'generaltranslation';
import { CustomMapping } from 'generaltranslation/types';
import {
  getLoadTranslationsType,
  LoadTranslationsType,
} from './utils/getLoadTranslationsType';
import {
  getTranslationApiType,
  TranslationApiType,
} from './utils/getTranslationApiType';

abstract class I18nManager {
  private config: I18nManagerConfig;

  /**
   * Cache for translations
   */
  private translationsManager: TranslationsManager;

  /**
   * Store adapter
   */
  protected abstract storeAdapter: StorageAdapter;

  /**
   * Creates an instance of I18nManager.
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
    return this.storeAdapter.getItem('locale') || libraryDefaultLocale;
  }

  /**
   * Set the locale
   */
  setLocale(locale: string): void {
    this.storeAdapter.setItem('locale', locale);
  }

  /**
   * Get the locales
   */
  getLocales(): string[] {
    return this.config.locales;
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

export default I18nManager;

// ===== Helper Functions ===== //

/**
 * Standardize the config
 * @param config - The config to standardize
 * @returns The standardized config
 */
function standardizeConfig(
  config: I18nManagerConstructorParams
): I18nManagerConfig {
  const gtServicesEnabled =
    getLoadTranslationsType(config) === LoadTranslationsType.GT_REMOTE ||
    getTranslationApiType(config) === TranslationApiType.GT;

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
  const locales = config.locales.map(standardizeLocale);
  const customMapping = Object.fromEntries(
    Object.entries(config.customMapping || {}).map(([key, value]) => [
      standardizeLocale(key),
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
