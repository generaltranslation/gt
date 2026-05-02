import type { CustomMapping } from 'generaltranslation/types';
import type { GTConfig } from '../config/types';
import type { TranslationsLoader } from './translations-manager/translations-loaders/types';
import type { Translation } from './translations-manager/utils/types/translation-data';
import type { LifecycleCallbacks } from './lifecycle-hooks/types';
import type { Dictionary } from './translations-manager/DictionaryCache';
import type { DictionaryLoader } from './translations-manager/LocalesDictionaryCache';

type DictionaryConfig =
  | {
      dictionary: Dictionary;
      loadDictionary?: DictionaryLoader;
    }
  | {
      dictionary?: Dictionary;
      loadDictionary?: undefined;
    };

/**
 * Parameters for the I18nManager constructor
 */
export type I18nManagerConstructorParams<
  TranslationValue extends Translation = Translation,
> = GTConfig &
  DictionaryConfig & {
    loadTranslations?: TranslationsLoader;
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

export type {
  TranslationsLoader,
  LifecycleCallbacks,
  Dictionary,
  DictionaryLoader,
};
