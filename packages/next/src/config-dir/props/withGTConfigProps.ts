import { CustomMapping } from 'generaltranslation/types';
import { RenderMethod } from 'gt-react/internal';

export type HeadersAndCookies = {
  localeHeaderName?: string;
  localeCookieName?: string;
  referrerLocaleCookieName?: string;
  localeRoutingEnabledCookieName?: string;
  resetLocaleCookieName?: string;
};

type withGTConfigProps = {
  // Request scoped filepath
  dictionary?: string;
  config?: string;
  loadTranslationsPath?: string;
  loadDictionaryPath?: string;
  // Cloud integration
  apiKey?: string;
  projectId?: string;
  runtimeUrl?: string | null;
  cacheUrl?: string | null;
  cacheExpiryTime?: number;
  // Locale info
  locales?: string[];
  defaultLocale?: string;
  ignoreBrowserLocales?: boolean;
  getLocalePath?: string;
  // Custom mapping
  customMapping?: CustomMapping;
  // Rendering
  renderSettings?: {
    method: RenderMethod;
    timeout?: number;
  };
  // Batching config
  maxConcurrentRequests?: number;
  maxBatchSize?: number;
  batchInterval?: number; // ms
  // Translation assistance
  description?: string;
  // Other
  headersAndCookies?: HeadersAndCookies;
  _usingPlugin?: boolean;
  [key: string]: any;
};

export default withGTConfigProps;
