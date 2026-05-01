import type { CustomMapping } from 'generaltranslation/types';
import { GTConfig } from '../config/types';
import { TranslationsLoader } from './translations-manager/translations-loaders/types';
import { Translation } from './translations-manager/utils/types/translation-data';
import type { LifecycleCallbacks } from './lifecycle-hooks/types';
import type { TranslationBatchConfig } from './translations-manager/TranslationsCache';

export type RuntimeTranslateManyOptions = {
  sourceLocale?: string;
  modelProvider?: string;
  [key: string]: unknown;
};

export type RuntimeTranslationConfig = {
  timeout?: number;
  metadata?: RuntimeTranslateManyOptions;
};

/**
 * Parameters for the I18nManager constructor
 */
export type I18nManagerConstructorParams<
  TranslationValue extends Translation = Translation,
> = Omit<GTConfig, 'cacheExpiryTime'> & {
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
export type ConditionStoreConfig = {
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
export interface ConditionStore {
  getLocale(): string;
}

/**
 * Condition store contract for runtimes that can persist locale changes.
 */
export interface WritableConditionStore extends ConditionStore {
  setLocale(locale: string): void;
}

/**
 * Condition store contract for runtimes with scoped locale context.
 */
export interface ScopedConditionStore extends ConditionStore {
  run<T>(locale: string, callback: () => T): T;
}

export type { TranslationsLoader, LifecycleCallbacks };
