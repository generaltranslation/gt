import type { RuntimeTranslateManyOptions } from 'generaltranslation/internal';
import type { CustomMapping } from '@generaltranslation/format/types';
import type { GTConfig } from '../config/types';
import type { TranslationsLoader } from './translations-manager/translations-loaders/types';
import type { TranslationBatchConfig } from './translations-manager/TranslationsCache';
import type {
  Dictionary,
  DictionaryLoader,
} from './translations-manager/DictionaryCache';

export type DictionaryConfig = {
  dictionary?: Dictionary;
  loadDictionary?: DictionaryLoader;
};

type RuntimeTranslationConfig = {
  timeout?: number;
  metadata?: RuntimeTranslateManyOptions;
};

/**
 * Parameters for the I18nCache constructor
 */
export type I18nCacheConstructorParams = DictionaryConfig &
  Omit<
    GTConfig,
    | 'cacheExpiryTime'
    | 'defaultLocale'
    | 'locales'
    | 'customMapping'
    | 'enableI18n'
  > & {
    /**
     * Locale cache TTL in milliseconds. Undefined uses the default TTL, null
     * disables expiry, and a number sets an explicit TTL.
     */
    cacheExpiryTime?: number | null;
    loadTranslations?: TranslationsLoader;
    batchConfig?: TranslationBatchConfig;
    runtimeTranslation?: RuntimeTranslationConfig;
  };

/**
 * I18nCache class configuration
 */
export type I18nCacheConfig = {
  projectId?: string;
  modelProvider?: string;
  /**
   * Locale cache TTL in milliseconds. Undefined uses the default TTL, null
   * disables expiry, and a number sets an explicit TTL.
   */
  cacheExpiryTime?: number | null;
  batchConfig?: TranslationBatchConfig;
  runtimeTranslation?: RuntimeTranslationConfig;
  _versionId?: string;
};

/**
 * Shared configuration used by condition stores to resolve locales.
 */
export type LocaleResolverConfig = {
  defaultLocale?: string;
  locales?: string[];
  customMapping?: CustomMapping;
};

/**
 * Minimal runtime condition store contract.
 *
 * Locale is the first condition exposed by this contract; additional runtime
 * conditions can be added here as needed.
 */
export interface ReadonlyConditionStoreInterface {
  getLocale(): string;
  getRegion(): string | undefined;
  getEnableI18n(): boolean;

  // --- no-op methods --- //
  /**
   * ReadonlyConditionStore is used in SSR GTProvider
   * These have to be included to avoid throwing errors during SSR
   * const setLocale = useSetLocale();
   * setLocale('es-ES'); // -> cannot invoke undefined function
   */
  setLocale(locale: string): void;
  setRegion(region: string | undefined): void;
  setEnableI18n(enabled: boolean): void;
}

/**
 * Condition store contract for runtimes that can persist locale changes.
 */
export interface WritableConditionStoreInterface extends ReadonlyConditionStoreInterface {
  setLocale(locale: string): void;
  setRegion(region: string | undefined): void;
  setEnableI18n(enabled: boolean): void;
}

/**
 * Condition store contract for runtimes with scoped locale context.
 */
export interface ScopedConditionStoreInterface extends ReadonlyConditionStoreInterface {
  run<T>(locale: string, callback: () => T): T;
}

/**
 * Async condition store contract for runtimes with scoped locale context.
 */
export interface AsyncReadonlyConditionStoreInterface {
  getLocale(): Promise<string>;
  getRegion(): Promise<string | undefined>;
  getEnableI18n(): Promise<boolean>;
}

export type { TranslationsLoader, Dictionary, DictionaryLoader };
