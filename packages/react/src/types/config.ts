// Type definition for the params extracted from gt.config.json

import {
  RenderMethod,
  Dictionary,
  Translations,
  CustomLoader,
  GTConfig,
  UseDetermineLocaleParams,
  UseDetermineLocaleReturn,
} from '@generaltranslation/react-core/types';
import { CustomMapping } from 'generaltranslation/types';

export type ClientProviderProps = {
  children: any;
  dictionary: Dictionary;
  dictionaryTranslations: Dictionary;
  translations: Translations;
  locale: string;
  locales: string[];
  region?: string; // should be made mandatory if we ever make region a server-side variable
  _versionId?: string;
  dictionaryEnabled?: boolean;
  defaultLocale: string;
  translationRequired: boolean;
  dialectTranslationRequired: boolean;
  renderSettings: {
    method: RenderMethod;
    timeout?: number;
  };
  developmentApiEnabled: boolean;
  projectId?: string;
  devApiKey?: string;
  runtimeUrl?: string | null;
  gtServicesEnabled?: boolean;
  localeCookieName?: string;
  resetLocaleCookieName: string;
  regionCookieName?: string;
  customMapping?: CustomMapping;
  environment: 'development' | 'production' | 'test';
  reloadServer: () => void;
};

export type GTProviderProps = {
  children?: React.ReactNode;
  projectId?: string;
  devApiKey?: string;
  dictionary?: any;
  locales?: string[];
  defaultLocale?: string;
  locale?: string;
  region?: string;
  cacheUrl?: string | null;
  runtimeUrl?: string | null;
  renderSettings?: {
    method: RenderMethod;
    timeout?: number;
  };
  _versionId?: string;
  ssr?: boolean;
  localeCookieName?: string;
  translations?: Translations | null;
  loadDictionary?: CustomLoader;
  loadTranslations?: CustomLoader;
  config?: GTConfig;
  fallback?: React.ReactNode;
  customMapping?: CustomMapping;
  modelProvider?: string;
  enableI18n?: boolean;
  enableI18nLoaded?: boolean;
  /**
   * @internal - internal use only
   * TODO: this should have a separate export for internal use
   */
  useDetermineLocale?: (
    params: UseDetermineLocaleParams
  ) => UseDetermineLocaleReturn;
  reloadOnLocaleUpdate?: boolean;
  [key: string]: any;
};
