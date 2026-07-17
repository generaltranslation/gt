export type HeadersAndCookies = {
  localeHeaderName?: string;
  localeCookieName?: string;
  enableI18nCookieName?: string;
  referrerLocaleCookieName?: string;
  localeRoutingEnabledCookieName?: string;
  resetLocaleCookieName?: string;
};

export type CompilerOptions = {
  /**
   * Which compiler plugin to use: babel, swc, or none
   * @default 'none'
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
  /**
   * Whether to automatically wrap translatable JSX.
   * @default false
   */
  enableAutoJsxInjection?: boolean;
};

export type RenderMethod = 'skeleton' | 'replace' | 'default';

export const REQUEST_FUNCTION_TO_CONFIG_KEY = {
  getLocale: 'getLocalePath',
  getRegion: 'getRegionPath',
} as const;

export type BaseWithGTConfigProps = {
  // Additional top-level keys are forwarded as runtime translation metadata.
  [key: string]: unknown;
  // Request scoped filepath
  dictionary?: string;
  config?: string;
  loadTranslationsPath?: string;
  loadDictionaryPath?: string;
  // Cloud integration. Credentials are read from environment variables.
  runtimeUrl?: string | null;
  cacheUrl?: string | null;
  cacheExpiryTime?: number;
  // Locale info
  locales?: string[];
  defaultLocale?: string;
  ignoreBrowserLocales?: boolean;
  disableInvalidLocaleWarning?: boolean;
  /** Regular expression source that limits i18n middleware routing by pathname. */
  pathRegex?: string;
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
  experimentalCompilerOptions?: CompilerOptions;
  headersAndCookies?: HeadersAndCookies;
  _usingPlugin?: boolean;
  // Request function paths
  getLocalePath?: string;
  getRegionPath?: string;
};

export type withGTConfigProps = BaseWithGTConfigProps & {
  /** Use GT_API_KEY instead. */
  apiKey?: never;
  /** Use NEXT_PUBLIC_GT_DEV_API_KEY or GT_DEV_API_KEY instead. */
  devApiKey?: never;
  /** Use NEXT_PUBLIC_GT_PROJECT_ID or GT_PROJECT_ID instead. */
  projectId?: never;
};
