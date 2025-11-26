import React from 'react';
import { RenderMethod } from './types';
import { Translations, CustomLoader } from './types';
import { CustomMapping } from 'generaltranslation/types';

// Special overriden function types
import { AuthFromEnvParams, AuthFromEnvReturn } from '../utils/types';
import {
  UseDetermineLocaleParams,
  UseDetermineLocaleReturn,
} from '../provider/hooks/locales/types';
import {
  UseRegionStateParams,
  UseRegionStateReturn,
  UseEnableI18nParams,
  UseEnableI18nReturn,
} from '../provider/hooks/types';

// Configuration for the enableI18n feature flag
export type EnableI18nConfig = {
  /** Persist the feature flag as a cookie @default false (use when loading flag asynchronously) */
  persist?: boolean;
  /** Name of cookie @default defaultEnableI18nCookieName */
  cookieName?: string;
};

// Type definition for the config object passed to the GTProvider
export type GTConfig = {
  projectId?: string;
  devApiKey?: string;
  locales?: string[];
  defaultLocale?: string;
  dictionary?: string; // path to the dictionary file
  runtimeUrl?: string | null;
  cacheUrl?: string | null;
  renderSettings?: {
    method: RenderMethod;
    timeout?: number;
  };
  _versionId?: string;
  ssr?: boolean;
  localeCookieName?: string;
  customMapping?: CustomMapping;
  modelProvider?: string;
  enableI18n?: boolean;
};

export type InternalGTProviderProps = {
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
  environment: 'development' | 'production' | 'test';
  /* flag to enable i18n, true by default */
  enableI18n?: boolean;
  /** Flag to indicate if the enableI18n flag is finished loading asynchronously */
  enableI18nLoaded?: boolean;
  readAuthFromEnv: (params: AuthFromEnvParams) => AuthFromEnvReturn;
  useDetermineLocale: (
    params: UseDetermineLocaleParams
  ) => UseDetermineLocaleReturn;
  useRegionState: (params: UseRegionStateParams) => UseRegionStateReturn;
  useEnableI18n?: (params: UseEnableI18nParams) => UseEnableI18nReturn;
  [key: string]: any;
};
