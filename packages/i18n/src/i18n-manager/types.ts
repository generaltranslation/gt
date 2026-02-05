import { CustomMapping } from 'generaltranslation/types';
import { GTConfig } from '../config/types';
import { StorageAdapter } from './storage-adapter/StorageAdapter';
import { TranslationsLoader } from './translations-manager/translations-loaders/types';

/**
 * Parameters for the I18nManager constructor
 */
export type I18nManagerConstructorParams<T extends StorageAdapter> =
  GTConfig & {
    customTranslationLoader?: TranslationsLoader;
    storeAdapter?: T;
  };

/**
 * I18nManager class configuration
 */
export type I18nManagerConfig = {
  defaultLocale: string;
  locales: string[];
  customMapping: CustomMapping;
  enableI18n: boolean;
  projectId?: string;
  devApiKey?: string;
  apiKey?: string;
  runtimeUrl?: string | null;
};
