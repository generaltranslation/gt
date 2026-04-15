import { StorageAdapterType } from './storage-adapter/types';
import { CustomMapping } from 'generaltranslation/types';
import { GTConfig } from '../config/types';
import { StorageAdapter } from './storage-adapter/StorageAdapter';
import { TranslationsLoader } from './translations-manager/translations-loaders/types';
import { Translation } from './translations-manager/utils/types/translation-data';
import { Hash } from './translations-manager/TranslationsCache';
import { Locale } from './translations-manager/LocalesCache';

/**
 * Lifecycle callback definitions
 */
type LocaleCacheLifecycleCallback<TranslationValue extends Translation> =
  (params: { locale: Locale; value: Record<Hash, TranslationValue> }) => void;
type TranslationsCacheLifecycleCallback<TranslationValue extends Translation> =
  (params: { locale: Locale; hash: Hash; value: TranslationValue }) => void;
export type LifecycleCallbacks<TranslationValue extends Translation> = {
  onTranslationsCacheHit?: TranslationsCacheLifecycleCallback<TranslationValue>;
  onTranslationsCacheMiss?: TranslationsCacheLifecycleCallback<TranslationValue>;
  onLocalesCacheHit?: LocaleCacheLifecycleCallback<TranslationValue>;
  onLocalesCacheMiss?: LocaleCacheLifecycleCallback<TranslationValue>;
};

/**
 * Parameters for the I18nManager constructor
 */
export type I18nManagerConstructorParams<
  T extends StorageAdapter = StorageAdapter,
  TranslationValue extends Translation = Translation,
> = GTConfig & {
  loadTranslations?: TranslationsLoader;
  storeAdapter?: T;
  environment?: 'development' | 'production';
  // Cache lifecycle hooks
  lifecycle: LifecycleCallbacks<TranslationValue>;
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
  _versionId?: string;
};

export type { TranslationsLoader, StorageAdapter, StorageAdapterType };
