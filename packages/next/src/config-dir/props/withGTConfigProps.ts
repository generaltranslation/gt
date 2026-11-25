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
     *
     * A Turbopack production build also sends some translations with the
     * page that uses them instead of from the root layout's `GTProvider`. The
     * SWC plugin wraps a server `page` file in a `GtSegment` when its default
     * export is a function written in that file (a function declaration, an
     * arrow or function expression, or the name of one declared there with
     * `function`, `const` or `let`) and it exports no `dynamic` other than the
     * literal `'auto'` or `'force-dynamic'`; `'use client'` pages and `page`
     * files in private folders (`_lib`) are not wrapped. The build then places
     * the translation of a compiled client `<T>` with a page only when that
     * page's entry alone loads every client chunk holding it and the page's
     * wrapper is found in the server files of every route that renders the
     * page; every other translation stays with the root layout, as do those
     * of a page under a `layout` that exports `dynamic` other than the literal
     * `'auto'` or `'force-dynamic'`, which can make the page static.
     * A component loaded with `next/dynamic` from a server component of one
     * page can be placed with that page, while chunks loaded lazily on the
     * client stay with the root layout. A webpack build, `next dev`, and a
     * build with `cacheComponents` or `experimental.useCache` place none.
     *
     * Known limitation: an unhashed client `<T>` can also lose its
     * translation when a compiled `<T>` with the same content is placed with
     * another page.
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
