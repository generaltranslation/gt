import type { CustomMapping } from 'generaltranslation/types';
import { GTConfig } from '../config/types';
import { StorageAdapter } from './storage-adapter/StorageAdapter';
import { StorageAdapterType } from './storage-adapter/types';
import { TranslationsLoader } from './translations-manager/translations-loaders/types';
import { Translation } from './translations-manager/utils/types/translation-data';
import type { LifecycleCallbacks } from './lifecycle-hooks/types';

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
  _versionId?: string;
};

export type {
  TranslationsLoader,
  StorageAdapter,
  StorageAdapterType,
  LifecycleCallbacks,
};
