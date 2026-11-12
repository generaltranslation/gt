import type { GTCompilerOptions, GTConfig } from 'generaltranslation';
import type { MiddlewareConfig } from '../../middleware-dir/types';
import type { GTNextOptions } from '../schema';

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

export const REQUEST_FUNCTION_TO_CONFIG_KEY = {
  getLocale: 'getLocalePath',
  getRegion: 'getRegionPath',
} as const;

// Middleware options are defaults for createNextMiddleware(), passed via env.
// Every gt.config.json key gt-next reads is accepted; GTConfig and
// GTNextOptions document them.
export type BaseWithGTConfigProps = MiddlewareConfig &
  Omit<GTConfig & GTNextOptions, keyof MiddlewareConfig> & {
    /** Path to gt.config.json. Defaults to the first standard location that exists. */
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
  /** Use GT_API_KEY instead. */
  devApiKey?: never;
  /** Use GT_PROJECT_ID instead. */
  projectId?: never;
};
