import type { GTIntl } from '@generaltranslation/format';
import type { GTConfig } from 'generaltranslation';
import type { BaseWithGTConfigProps } from '../config-dir/props/withGTConfigProps';
import type { GTNextOptions } from '../config-dir/schema';
import type { PathConfig, PathMatcher } from './createPathMatcher';

export type RouteOverrides = Record<string, readonly string[]>;

export type LocaleRoutes = Record<string, readonly string[]>;

/**
 * Locale routing options accepted by both `createNextMiddleware()` and
 * `withGTConfig()`. Options passed to `createNextMiddleware()` take precedence.
 * GTConfig and GTNextOptions document each option.
 */
export type MiddlewareConfig = Pick<GTConfig, 'localeRouting'> &
  Pick<
    GTNextOptions,
    | 'prefixDefaultLocale'
    | 'enableSmartRouting'
    | 'ignoreSourceMaps'
    | 'pathConfig'
  > & {
    // Declared here to also accept readonly arrays, which GTNextOptions' do not.
    routeOverrides?: RouteOverrides;
    localeRoutes?: LocaleRoutes;
  };

export type ResolvedMiddlewareConfig = Required<MiddlewareConfig>;

/** The subset of the i18n config params read by the middleware. */
export type MiddlewareI18nConfig = Pick<
  BaseWithGTConfigProps,
  | 'customMapping'
  | 'defaultLocale'
  | 'locales'
  | 'localeMatcher'
  | 'headersAndCookies'
>;

/** Locale, cookie, and path state pre-processed once per middleware instance. */
export type MiddlewareRouting = {
  pathRegex: RegExp | undefined;
  gt: GTIntl;
  defaultLocale: string;
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
