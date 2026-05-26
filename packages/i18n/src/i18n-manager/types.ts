import type { RuntimeTranslateManyOptions } from 'generaltranslation/internal';
import type { CustomMapping } from '@generaltranslation/format/types';
import type { GTConfig } from '../config/types';
import type { TranslationsLoader } from './translations-manager/translations-loaders/types';
import type { Translation } from './translations-manager/utils/types/translation-data';
import type { LifecycleCallbacks } from './lifecycle-hooks/types';
import type { TranslationBatchConfig } from './translations-manager/TranslationsCache';
import type {
  Dictionary,
  DictionaryLoader,
} from './translations-manager/DictionaryCache';

export type DictionaryConfig =
  | {
      dictionary: Dictionary;
      loadDictionary?: DictionaryLoader;
    }
  | {
      dictionary?: Dictionary;
      loadDictionary?: undefined;
    };

type RuntimeTranslationConfig = {
  timeout?: number;
  metadata?: RuntimeTranslateManyOptions;
};

/**
 * Parameters for the I18nManager constructor
 */
export type I18nManagerConstructorParams<
  TranslationValue extends Translation = Translation,
> = DictionaryConfig &
  Omit<GTConfig, 'cacheExpiryTime'> & {
    /**
     * Locale cache TTL in milliseconds. Undefined uses the default TTL, null
     * disables expiry, and a number sets an explicit TTL.
     */
    cacheExpiryTime?: number | null;
    loadTranslations?: TranslationsLoader;
    environment?: 'development' | 'production';
    batchConfig?: TranslationBatchConfig;
    runtimeTranslation?: RuntimeTranslationConfig;
    // Cache lifecycle hooks
    /** @deprecated - move to subscription api instead */
    lifecycle?: LifecycleCallbacks<TranslationValue>;
  };

/**
 * I18nManager class configuration
 */
export type I18nManagerConfig = {
  environment: 'development' | 'production';
  defaultLocale: string;
  locales: string[];
  customMapping: CustomMapping;
  /**
   * @deprecated
   * Perhaps we can keep this around, but more for
   * doing an initial load, but it may get overwritten
   * so like a "initialEnableI18n" flag?
   */
  enableI18n: boolean;
  projectId?: string;
  devApiKey?: string;
  apiKey?: string;
  runtimeUrl?: string | null;
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
  getEnableI18n(): boolean;

  // --- no-op methods --- //
  /**
   * ReadonlyConditionStore is used in SSR GTProvider
   * These have to be included to avoid throwing errors during SSR
   * const setLocale = useSetLocale();
   * setLocale('es-ES'); // -> cannot invoke undefined function
   */
  setLocale(locale: string): void;
  setEnableI18n(enabled: boolean): void;
}

/**
 * Condition store contract for runtimes that can persist locale changes.
 */
export interface WritableConditionStoreInterface extends ReadonlyConditionStoreInterface {
  setLocale(locale: string): void;
  setEnableI18n(enabled: boolean): void;
}

/**
 * Condition store contract for runtimes with scoped locale context.
 */
export interface ScopedConditionStoreInterface extends ReadonlyConditionStoreInterface {
  run<T>(locale: string, callback: () => T): T;
}

export type {
  TranslationsLoader,
  LifecycleCallbacks,
  Dictionary,
  DictionaryLoader,
};
