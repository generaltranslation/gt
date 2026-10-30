import { GTIntl } from '@generaltranslation/format';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import {
  defaultLocaleCookieName,
  defaultResetLocaleCookieName,
} from '@generaltranslation/react-core/pure';
import {
  createInvalidMiddlewareDefaultLocaleError,
  createUnsupportedLocalesWarning,
} from '../errors/middleware';
import {
  defaultLocaleRoutingEnabledCookieName,
  defaultReferrerLocaleCookieName,
} from '../utils/cookies';
import { defaultLocaleHeaderName } from '../utils/headers';
import { parseEnvConfig } from '../utils/parseEnvConfig';
import { compilePathRegex } from '../utils/pathRegex';
import {
  createPathMatcher,
  createPathToSharedPathMap,
  type PathConfig,
  type PathMatcher,
} from './createPathMatcher';
import type {
  MiddlewareI18nConfig,
  MiddlewareRouting,
  ResolvedMiddlewareConfig,
  RouteOverrides,
} from './types';

/**
 * Pre-processes the locale, cookie, and path configuration once per
 * middleware instance so requests only do lookups.
 */
export function createMiddlewareRouting({
  pathConfig: inputPathConfig,
  routeOverrides: inputRouteOverrides,
  localeRoutes,
  prefixDefaultLocale,
}: ResolvedMiddlewareConfig): MiddlewareRouting {
  const pathRegex = compilePathRegex(
    process.env._GENERALTRANSLATION_PATH_REGEX
  );

  // i18n config
  const i18nConfig = parseEnvConfig<MiddlewareI18nConfig>(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS
  );

  // Configured spellings are the identity used by routes, cookies and caches.
  const defaultLocale: string =
    i18nConfig.defaultLocale || libraryDefaultLocale;
  const locales = Array.from(
    new Set([defaultLocale, ...(i18nConfig.locales || [])])
  );
  const gt = new GTIntl({
    locales,
    customMapping: i18nConfig.customMapping,
    localeMatcher: i18nConfig.localeMatcher,
  });
  // Route entries repeat locale keys. Resolve each key once per factory instead
  // of rebuilding the full locale-resolution index for every route/locale pair.
  const resolvedConfigLocales = new Map<string, string>();
  const determineLocaleWithCache = (locale: string) => {
    const cached = resolvedConfigLocales.get(locale);
    if (cached !== undefined) return cached;
    const resolved = gt.determineLocale(locale) ?? locale;
    resolvedConfigLocales.set(locale, resolved);
    return resolved;
  };
  const resolvePathConfigLocale =
    process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED === 'true'
      ? determineLocaleWithCache
      : (locale: string) => locale;

  // cookies and header names
  const headersAndCookies = i18nConfig.headersAndCookies || {};
  const localeRoutingEnabledCookieName =
    headersAndCookies?.localeRoutingEnabledCookieName ||
    defaultLocaleRoutingEnabledCookieName;
  const referrerLocaleCookieName =
    headersAndCookies?.referrerLocaleCookieName ||
    defaultReferrerLocaleCookieName;
  const localeCookieName =
    headersAndCookies?.localeCookieName || defaultLocaleCookieName;
  const resetLocaleCookieName =
    headersAndCookies?.resetLocaleCookieName || defaultResetLocaleCookieName;
  const localeHeaderName =
    headersAndCookies?.localeHeaderName || defaultLocaleHeaderName;

  if (!gt.isValidLocale(defaultLocale))
    throw new Error(createInvalidMiddlewareDefaultLocaleError(defaultLocale));

  const warningLocales = locales.filter((locale) => !gt.isValidLocale(locale));
  if (warningLocales.length)
    console.warn(createUnsupportedLocalesWarning(warningLocales));

  // --- localized routes --- //
  // Resolve pathConfig keys to the configured locale spelling.
  const pathConfig = Object.entries(inputPathConfig).reduce<PathConfig>(
    (acc, [sharedPath, localizedPath]) => {
      if (typeof localizedPath === 'string') {
        acc[sharedPath] = localizedPath;
      } else {
        acc[sharedPath] = Object.entries(localizedPath).reduce<{
          [key: string]: string;
        }>((acc, [locale, localizedPath]) => {
          acc[resolvePathConfigLocale(locale)] = localizedPath;
          return acc;
        }, {});
      }
      return acc;
    },
    {}
  );

  // String aliases apply to every locale, including the default locale.
  // Expand a copy for lookup while retaining string target semantics in routing.
  const matcherPathConfig = Object.fromEntries(
    Object.entries(pathConfig).map(([sharedPath, localizedPath]) => [
      sharedPath,
      typeof localizedPath === 'string'
        ? Object.fromEntries(
            locales.map((locale) => [
              determineLocaleWithCache(locale),
              localizedPath === '' ? '/' : localizedPath,
            ])
          )
        : localizedPath,
    ])
  );

  // Create the path mapping
  const { pathToSharedPath, defaultLocalePaths } = createPathToSharedPathMap(
    matcherPathConfig,
    prefixDefaultLocale,
    defaultLocale
  );

  // --- route overrides --- //
  // Resolve routeOverrides keys to the configured locale spelling.
  const routeOverrides = Object.entries(
    inputRouteOverrides
  ).reduce<RouteOverrides>((acc, [locale, paths]) => {
    acc[resolvePathConfigLocale(locale)] = paths;
    return acc;
  }, {});

  // Create the route override path mapping
  const routeOverridePathMaps = Object.entries(routeOverrides).reduce<
    Record<string, PathMatcher>
  >((acc, [locale, paths]) => {
    const overridePathConfig = Object.fromEntries(
      paths.map((path) => [path, path])
    );
    acc[locale] = createPathToSharedPathMap(
      overridePathConfig,
      true,
      defaultLocale
    ).pathToSharedPath;
    return acc;
  }, {});

  // --- locale routes --- //
  // Compile availability separately from aliases and overrides so it cannot
  // change route precedence. An empty list deliberately matches nothing.
  const localeRoutePathMaps = new Map(
    Object.entries(localeRoutes).map(([locale, paths]) => {
      // Match request resolution so equivalent spellings use the same map key.
      const resolvedLocale = determineLocaleWithCache(locale);
      return [
        resolvedLocale,
        createPathMatcher(paths.map((path) => [path, path])),
      ];
    })
  );

  return {
    pathRegex,
    gt,
    defaultLocale,
    locales,
    localeRoutingEnabledCookieName,
    referrerLocaleCookieName,
    localeCookieName,
    resetLocaleCookieName,
    localeHeaderName,
    pathConfig,
    pathToSharedPath,
    defaultLocalePaths,
    routeOverridePathMaps,
    localeRoutePathMaps,
  };
}
