import type { GTCompilerOptions, GTConfig } from 'generaltranslation';
import type { MiddlewareConfig } from '../../middleware-dir/types';
import type { InferInput } from 'valibot';
import type { GTNextOptions, SplitTranslationsSchema } from '../schema';

type HeadersAndCookies = {
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
    // Other
    experimentalCompilerOptions?: CompilerOptions;
    /**
     * Experimental: production App Router builds stop sending client
     * components the translations of `<T>` that only server components render.
     * Needs `experimentalCompilerOptions.type` `'swc'` (next@16.1.0+) or
     * `'babel'` with webpack (next@15.4.0+); `enabled`, else
     * `GT_SPLIT_TRANSLATIONS`, else setting the option, turns it on.
     */
    experimentalSplitTranslations?: InferInput<typeof SplitTranslationsSchema>;
    headersAndCookies?: HeadersAndCookies;
    _usingPlugin?: boolean;
  };

export type withGTConfigProps = BaseWithGTConfigProps & {
  /** Use GT_API_KEY instead. */
  apiKey?: never;
};
