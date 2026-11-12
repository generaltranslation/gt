import type { GTIntl } from '@generaltranslation/format';
import type {
  CustomMapping,
  LocaleMatcher,
} from '@generaltranslation/format/types';
import type { HeadersAndCookies } from '../config-dir/props/withGTConfigProps';
import type { PathConfig, PathMatcher } from './createPathMatcher';

export type RouteOverrides = Record<string, readonly string[]>;

export type LocaleRoutes = Record<string, readonly string[]>;

/**
 * Locale routing options accepted by both `createNextMiddleware()` and
 * `withGTConfig()`. Options passed to `createNextMiddleware()` take precedence.
 */
export type MiddlewareConfig = {
  /** Enable automatic locale-based routing. */
  localeRouting?: boolean;
  /** Prefix the default locale to the pathname, i.e. `/about` -> `/en/about`. */
  prefixDefaultLocale?: boolean;
  /**
   * Keep automatic locale negotiation. Disable to treat returning visitors'
   * unprefixed URLs as default-locale routes.
   */
  enableSmartRouting?: boolean;
  /** Skip Next.js source map requests. */
  ignoreSourceMaps?: boolean;
  /** Localized path aliases. */
  pathConfig?: PathConfig;
  /** Locale-relative paths to rewrite from /{locale}/{path} to /{locale}/{locale}/{path}. */
  routeOverrides?: RouteOverrides;
  /** Shared paths available per locale; other paths fall back to the default locale. */
  localeRoutes?: LocaleRoutes;
};

export type ResolvedMiddlewareConfig = Required<MiddlewareConfig>;

/** The subset of the i18n config params read by the middleware. */
export type MiddlewareI18nConfig = {
  customMapping?: CustomMapping;
  defaultLocale?: string;
  locales?: string[];
  localeMatcher?: LocaleMatcher;
  headersAndCookies?: HeadersAndCookies;
};

/** Locale, cookie, and path state pre-processed once per middleware instance. */
export type MiddlewareRouting = {
  pathRegex: RegExp | undefined;
  gt: GTIntl;
  defaultLocale: string;
  locales: string[];
  localeRoutingEnabledCookieName: string;
  referrerLocaleCookieName: string;
  localeCookieName: string;
  resetLocaleCookieName: string;
  localeHeaderName: string;
  /** `pathConfig` with locale keys resolved to their configured spelling. */
  pathConfig: PathConfig;
  pathToSharedPath: PathMatcher;
  defaultLocalePaths: PathMatcher;
  routeOverridePathMaps: Record<string, PathMatcher>;
  localeRoutePathMaps: Map<string, PathMatcher>;
};
