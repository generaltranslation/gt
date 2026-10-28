import type { GTIntl } from '@generaltranslation/format';
import type { GTConfig } from 'generaltranslation/types';
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
 * GTConfig documents each option.
 */
export type MiddlewareConfig = Pick<
  GTConfig,
  | 'localeRouting'
  | 'prefixDefaultLocale'
  | 'enableSmartRouting'
  | 'ignoreSourceMaps'
  | 'pathConfig'
> & {
  // Declared here to also accept readonly arrays, which GTConfig's do not.
  routeOverrides?: RouteOverrides;
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
