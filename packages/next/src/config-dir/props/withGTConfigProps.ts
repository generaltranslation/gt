import { CustomMapping } from 'generaltranslation/types';
import { RenderMethod } from 'gt-react/internal';

export type HeadersAndCookies = {
  localeHeaderName?: string;
  localeCookieName?: string;
  referrerLocaleCookieName?: string;
  localeRoutingEnabledCookieName?: string;
  resetLocaleCookieName?: string;
};

export type CompilerOptions = {
  /**
   * Which compiler plugin to use: babel, swc, or none
   * @default 'babel'
   */
  type: 'babel' | 'swc' | 'none';
  /**
   * Log level for the compiler plugin.
   * @default 'warn'
   */
  logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug';
  /**
   * Whether to compile the translations at build time.
   * @default true
   */
  compileTimeHash?: boolean;
  /**
   * Whether to disable build checks.
   * @default false
   */
  disableBuildChecks?: boolean;
};

export const DEPRECATED_REQUEST_FUNCTION_TO_CONFIG_KEY = {
  getStaticLocale: 'getStaticLocalePath',
  getStaticRegion: 'getStaticRegionPath',
  getStaticDomain: 'getStaticDomainPath',
} as const;

export const REQUEST_FUNCTION_TO_CONFIG_KEY = {
  getLocale: 'getLocalePath',
  getRegion: 'getRegionPath',
  getDomain: 'getDomainPath',
  ...DEPRECATED_REQUEST_FUNCTION_TO_CONFIG_KEY,
} as const;

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
  // Custom mapping
  /**@deprecated Use customMapping in gt.config.json instead */
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
  /**
   * @deprecated use experimentalCompilerOptions instead
   */
  experimentalSwcPluginOptions?: Omit<CompilerOptions, 'type'>;
  experimentalCompilerOptions?: CompilerOptions;
  headersAndCookies?: HeadersAndCookies;
  _usingPlugin?: boolean;
  // SSG
  experimentalEnableSSG?: boolean;
  /** @deprecated */
  disableSSGWarnings?: boolean;
  // Request function paths
  getLocalePath?: string;
  getRegionPath?: string;
  getDomainPath?: string;
  /** @deprecated use getLocalePath instead */
  getStaticLocalePath?: string;
  /** @deprecated use getRegionPath instead */
  getStaticRegionPath?: string;
  /** @deprecated use getDomainPath instead */
  getStaticDomainPath?: string;
  [key: string]: any;
};

export default withGTConfigProps;
