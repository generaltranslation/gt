import { CustomMapping } from 'generaltranslation/types';
import { RenderMethod } from 'gt-react/internal';

export type HeadersAndCookies = {
  localeHeaderName?: string;
  localeCookieName?: string;
  referrerLocaleCookieName?: string;
  localeRoutingEnabledCookieName?: string;
  resetLocaleCookieName?: string;
};

export type SwcPluginOptions = {
  dynamicJsxCheckLogLevel?: 'error' | 'warn' | 'off';
  dynamicStringCheckLogLevel?: 'error' | 'warn' | 'off';
  experimentalCompileTimeHashCheck?: boolean;
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
  // ESLint integration
  eslint?: boolean; // Enable/disable ESLint config generation (default: true)
  eslintSeverity?: 'error' | 'warn'; // Severity level for ESLint rules (default: 'warn')
  overwriteESLintConfig?: boolean; // Allow overwriting existing eslint.config.mjs (default: false)
  // Other
  swcPluginOptions?: SwcPluginOptions;
  headersAndCookies?: HeadersAndCookies;
  _usingPlugin?: boolean;
  [key: string]: any;
};

export default withGTConfigProps;
