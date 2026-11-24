import type { GTCompilerOptions, GTConfig } from 'generaltranslation';
import type { MiddlewareConfig } from '../../middleware-dir/types';
import type { InferInput } from 'valibot';
import type { GTNextOptions, WithGTConfigPropsSchema } from '../schema';

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
     * Needs `experimentalCompilerOptions.type` `'swc'` (next@16.1.0+) with
     * `compileTimeHash` on; any other compiler warns and sends every
     * translation. Only `true` turns it on. A `<T>` in a client component must
     * be one the GT compiler hashes, `T` imported directly from `gt-next` and
     * written as JSX; otherwise its translation can be left out when a server
     * component renders the same content.
     */
    experimentalSplitTranslations?: InferInput<
      typeof WithGTConfigPropsSchema
    >['experimentalSplitTranslations'];
    headersAndCookies?: HeadersAndCookies;
    _usingPlugin?: boolean;
  };

export type withGTConfigProps = BaseWithGTConfigProps & {
  /** Use GT_API_KEY instead. */
  apiKey?: never;
};
