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
} from '../provider/hooks/types';

// Type definition for the config object passed to the GTProvider
export type GTConfig = {
  projectId?: string;
  devApiKey?: string;
  locales?: string[];
  defaultLocale?: string;
  dictionary?: string; // path to the dictionary file
  runtimeUrl?: string;
  cacheUrl?: string;
  renderSettings?: {
    method: RenderMethod;
    timeout?: number;
  };
  _versionId?: string;
  ssr?: boolean;
  localeCookieName?: string;
  customMapping?: CustomMapping;
  modelProvider?: string;
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
  cacheUrl?: string;
  runtimeUrl?: string;
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
  readAuthFromEnv: (params: AuthFromEnvParams) => AuthFromEnvReturn;
  useDetermineLocale: (
    params: UseDetermineLocaleParams
  ) => UseDetermineLocaleReturn;
  useRegionState: (params: UseRegionStateParams) => UseRegionStateReturn;
  [key: string]: any;
};
