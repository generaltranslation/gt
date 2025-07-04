// Type definition for the params extracted from gt.config.json

import { RenderMethod } from '../internal';
import { Dictionary, Translations, CustomLoader } from './types';
import { CustomMapping } from 'generaltranslation/types';

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
};

export type GTProviderProps = {
  children?: React.ReactNode;
  projectId?: string;
  devApiKey?: string;
  dictionary?: any;
  locales?: string[];
  defaultLocale?: string;
  locale?: string;
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
  [key: string]: any;
};

export type ClientProviderProps = {
  children: any;
  dictionary: Dictionary;
  initialTranslations: Translations;
  locale: string;
  locales: string[];
  _versionId?: string;
  dictionaryEnabled?: boolean;
  defaultLocale: string;
  translationRequired: boolean;
  dialectTranslationRequired: boolean;
  renderSettings: {
    method: RenderMethod;
    timeout?: number;
  };
  runtimeTranslationEnabled: boolean;
  projectId?: string;
  devApiKey?: string;
  runtimeUrl?: string | null;
  gtServicesEnabled?: boolean;
  localeCookieName?: string;
  resetLocaleCookieName: string;
  customMapping?: CustomMapping;
};
