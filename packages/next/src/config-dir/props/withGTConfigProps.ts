import type { GTCompilerOptions, GTConfig } from 'generaltranslation/types';
import type { MiddlewareConfig } from '../../middleware-dir/types';

export type HeadersAndCookies = {
  localeHeaderName?: string;
  localeCookieName?: string;
  enableI18nCookieName?: string;
  referrerLocaleCookieName?: string;
  localeRoutingEnabledCookieName?: string;
  resetLocaleCookieName?: string;
};

export type CompilerOptions = GTCompilerOptions & {
  /**
   * Which compiler plugin to use: babel, swc, or none
   * @default 'none'
   */
  type: 'babel' | 'swc' | 'none';
};

export type RenderMethod = NonNullable<GTConfig['renderSettings']>['method'];

export const REQUEST_FUNCTION_TO_CONFIG_KEY = {
  getLocale: 'getLocalePath',
  getRegion: 'getRegionPath',
} as const;

// Middleware options are defaults for createNextMiddleware(), passed via env.
// Keys gt.config.json can also set come from GTConfig, which documents them.
export type BaseWithGTConfigProps = MiddlewareConfig &
  Pick<
    GTConfig,
    | 'loadTranslationsPath'
    | 'loadDictionaryPath'
    | 'getLocalePath'
    | 'getRegionPath'
    | 'runtimeUrl'
    | 'cacheUrl'
    | 'cacheExpiryTime'
    | 'locales'
    | 'defaultLocale'
    | 'localeMatcher'
    | 'ignoreBrowserLocales'
    | 'disableInvalidLocaleWarning'
    | 'pathRegex'
    | 'renderSettings'
    | 'maxConcurrentRequests'
    | 'maxBatchSize'
    | 'batchInterval'
    | 'description'
    | '_tagIds'
  > & {
    // Additional top-level keys are forwarded as runtime translation metadata.
    [key: string]: unknown;
    config?: string;
    // GTConfig omits the file's dictionary path; see its definition.
    dictionary?: string;
    // ESLint integration
    eslint?: boolean; // Enable/disable ESLint config generation (default: true)
    eslintSeverity?: 'error' | 'warn'; // Severity level for ESLint rules (default: 'warn')
    overwriteESLintConfig?: boolean; // Allow overwriting existing eslint.config.mjs (default: false)
    // Other
    experimentalCompilerOptions?: CompilerOptions;
    headersAndCookies?: HeadersAndCookies;
    _usingPlugin?: boolean;
  };

export type withGTConfigProps = BaseWithGTConfigProps & {
  /** Use GT_API_KEY instead. */
  apiKey?: never;
  /** Use NEXT_PUBLIC_GT_DEV_API_KEY or GT_DEV_API_KEY instead. */
  devApiKey?: never;
  /** Use NEXT_PUBLIC_GT_PROJECT_ID or GT_PROJECT_ID instead. */
  projectId?: never;
};
