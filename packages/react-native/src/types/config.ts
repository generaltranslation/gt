import type {
  RenderMethod,
  Translations,
  CustomLoader,
  GTConfig,
} from '@generaltranslation/react-core/types';
import type { CustomMapping } from 'generaltranslation/types';

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
  [key: string]: any;
};
