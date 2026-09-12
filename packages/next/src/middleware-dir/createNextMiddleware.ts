import { applyTrailingSlash } from './pathname';
import { standardizeLocale } from '@generaltranslation/format';
import { GTRuntime } from 'generaltranslation/runtime';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { createUnsupportedLocalesWarning } from '../errors/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  defaultLocaleRoutingEnabledCookieName,
  defaultReferrerLocaleCookieName,
} from '../utils/cookies';
import {
  defaultLocaleCookieName,
  defaultResetLocaleCookieName,
} from '@generaltranslation/react-core/pure';
import {
  normalizePathname,
  getSharedPath,
  replaceDynamicSegments,
  getLocalizedPath,
  createPathToSharedPathMap,
  createPathMatcher,
  getLocaleFromRequest,
  getResponse,
  ResponseConfig,
  type PathConfig,
  type PathMatcher,
} from './utils';
import { defaultLocaleHeaderName } from '../utils/headers';
import type { CustomMapping } from '@generaltranslation/format/types';
import type { HeadersAndCookies } from '../config-dir/props/withGTConfigProps';
import { compilePathRegex, pathnameMatchesRegex } from '../utils/pathRegex';

const NEXT_JS_SOURCE_MAP_PATH = '/__nextjs_source-map';

type MiddlewareEnvConfig = {
  customMapping?: CustomMapping;
  defaultLocale?: string;
  locales?: string[];
  headersAndCookies?: HeadersAndCookies;
};

export type RouteOverrides = Record<string, readonly string[]>;

export type LocaleRoutes = Record<string, readonly string[]>;

/**
 * Middleware factory to create a Next.js middleware for i18n routing and locale detection.
 *
 * This middleware sets a cookie based on the locale derived from several sources
 * such as the request pathname, referer, or 'Accept-Language' header.
 * If locale routing is enabled, it redirects to the localized pathname and
 * updates the locale cookie.
 *
 * @param {boolean} [config.localeRouting=true] - Flag to enable or disable automatic locale-based routing.
 * @param {boolean} [config.prefixDefaultLocale=false] - Flag to enable or disable prefixing the default locale to the pathname, i.e., /en/about -> /about
 * @param {boolean} [config.ignoreSourceMaps=true] - Flag to enable or disable ignoring source maps
 * @param {PathConfig} [config.pathConfig] - Path configuration for locale routing
 * @param {RouteOverrides} [config.routeOverrides] - Locale-relative paths to rewrite from /{locale}/{path} to /{locale}/{locale}/{path}
 * @param {LocaleRoutes} [config.localeRoutes] - Shared paths available per locale; other paths fall back to the default locale
 * @returns {function} - A middleware function that processes the request and response.
 */
export function createNextMiddleware({
  localeRouting = true,
  prefixDefaultLocale = false,
  ignoreSourceMaps = true,
  pathConfig = {},
  routeOverrides = {},
  localeRoutes = {},
}: {
  localeRouting?: boolean;
  prefixDefaultLocale?: boolean;
  ignoreSourceMaps?: boolean;
  pathConfig?: PathConfig;
  routeOverrides?: RouteOverrides;
  localeRoutes?: LocaleRoutes;
} = {}) {
  const pathRegex = compilePathRegex(
    process.env._GENERALTRANSLATION_PATH_REGEX
  );

  // i18n config
  let envParams: MiddlewareEnvConfig | undefined;
  if (process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS) {
    try {
      envParams = JSON.parse(
        process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS
      );
    } catch (error) {
      console.error(`gt-next middleware:`, error);
    }
  }

  // gt instance
  const gt = new GTRuntime({
    customMapping: envParams?.customMapping,
  });

  // using gt services
  const gtServicesEnabled =
    process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED === 'true';

  // i18n config
  const configuredDefaultLocale: string =
    envParams?.defaultLocale || libraryDefaultLocale;
  // Match the normalization used by localized-path configuration keys.
  const defaultLocale = gtServicesEnabled
    ? standardizeLocale(configuredDefaultLocale)
    : configuredDefaultLocale;
  const locales: string[] = envParams?.locales || [defaultLocale];

  // add canonical locales
  const canonicalLocales = Object.values(envParams?.customMapping || {})
    .filter(
      (locale): locale is { code: string } =>
        typeof locale === 'object' &&
        locale !== null &&
        'code' in locale &&
        typeof locale.code === 'string' &&
        locale.code.length > 0
    )
    .map((locale) => locale.code);
  locales.push(...canonicalLocales);

  // Resolve default identity just as request locales are resolved. A supported
  // regional locale remains distinct, while equivalent spellings and aliases
  // still identify the configured default, including without GT services.
  const determinedDefaultLocale =
    gt.determineLocale([configuredDefaultLocale], locales) || defaultLocale;
  const resolvedDefaultLocale = gtServicesEnabled
    ? standardizeLocale(determinedDefaultLocale)
    : determinedDefaultLocale;

  const getRoutingLocale = (locale: string): string => {
    const alias = gt.resolveAliasLocale(locale);
    // Emit an alias only when request normalization resolves it back to this
    // locale. For example, en-gb can represent en-GB, but EN mapped to French
    // would be read as English after services-enabled normalization.
    const normalizedAlias = gtServicesEnabled
      ? standardizeLocale(alias)
      : alias;
    const determinedAlias = gt.determineLocale(normalizedAlias, locales);
    const resolvedAlias =
      determinedAlias && gtServicesEnabled
        ? standardizeLocale(determinedAlias)
        : determinedAlias;
    return resolvedAlias === locale ? alias : locale;
  };

  // cookies and header names
  const headersAndCookies = envParams?.headersAndCookies || {};
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
    throw new Error(
      `gt-next middleware: defaultLocale "${defaultLocale}" is not a valid locale.`
    );

  const warningLocales = locales.filter((locale) => !gt.isValidLocale(locale));
  if (warningLocales.length)
    console.warn(createUnsupportedLocalesWarning(warningLocales));

  // ---------- PRE-PROCESSING PATHS ---------- //

  // --- localized routes --- //
  // Standardize pathConfig paths
  pathConfig = Object.entries(pathConfig).reduce<PathConfig>(
    (acc, [sharedPath, localizedPath]) => {
      if (typeof localizedPath === 'string') {
        acc[sharedPath] = localizedPath;
      } else {
        acc[sharedPath] = Object.entries(localizedPath).reduce<{
          [key: string]: string;
        }>((acc, [locale, localizedPath]) => {
          acc[gtServicesEnabled ? standardizeLocale(locale) : locale] =
            localizedPath;
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
              gtServicesEnabled ? standardizeLocale(locale) : locale,
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
  // Standardize routeOverrides locales
  routeOverrides = Object.entries(routeOverrides).reduce<RouteOverrides>(
    (acc, [locale, paths]) => {
      acc[gtServicesEnabled ? standardizeLocale(locale) : locale] = paths;
      return acc;
    },
    {}
  );

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
    Object.entries(localeRoutes).map(([locale, paths]) => [
      gtServicesEnabled ? standardizeLocale(locale) : locale,
      createPathMatcher(paths.map((path) => [path, path])),
    ])
  );

  /**
   * Processes the incoming request to determine the user's locale and sets a locale cookie.
   * Optionally redirects the user based on the locale if locale-based routing is enabled.
   *
   * - Checks if the request URL contains a locale.
   * - Falls back to the referer URL for locale if needed.
   * - If no locale is found in the URL or referer, it checks the 'Accept-Language' header.
   * - Sets a cookie with the detected or default locale.
   * - Redirects to the correct locale route if locale routing is enabled.
   *
   * @param {NextRequest} req - The incoming request object, containing URL and headers.
   * @returns {NextResponse} - The Next.js response, either continuing the request or redirecting to the localized URL.
   */
  function middleware(req: NextRequest) {
    if (!pathnameMatchesRegex(req.nextUrl.pathname, pathRegex)) {
      return NextResponse.next();
    }

    // Ignore source maps
    if (
      ignoreSourceMaps &&
      req.nextUrl.pathname.startsWith(NEXT_JS_SOURCE_MAP_PATH)
    ) {
      return NextResponse.next();
    }

    // ---------- LOCALE DETECTION ---------- //

    const {
      userLocale: requestedLocale,
      pathnameLocale: pathnameRoutingLocale,
      unstandardizedPathnameLocale,
      clearResetCookie,
    } = getLocaleFromRequest(
      req,
      resolvedDefaultLocale,
      locales,
      localeRouting,
      gtServicesEnabled,
      prefixDefaultLocale,
      defaultLocalePaths,
      referrerLocaleCookieName,
      localeCookieName,
      resetLocaleCookieName,
      gt
    );

    // Keep normalized map keys separate from the alias used in route URLs.
    let userLocale = requestedLocale;
    let routingLocale = getRoutingLocale(userLocale);
    const determinedPathnameLocale = pathnameRoutingLocale
      ? gt.determineLocale(pathnameRoutingLocale, locales)
      : undefined;
    const pathnameLocale =
      determinedPathnameLocale && gtServicesEnabled
        ? standardizeLocale(determinedPathnameLocale)
        : determinedPathnameLocale;
    const headerList = new Headers(req.headers);

    const responseConfig: Omit<ResponseConfig, 'type'> = {
      originalUrl: req.nextUrl,
      headerList,
      userLocale,
      clearResetCookie,
      localeRouting,
      localeRoutingEnabledCookieName,
      resetLocaleCookieName,
      localeHeaderName,
    };

    const getRewriteResponse = (responsePath: string) =>
      getResponse({ responsePath, type: 'rewrite', ...responseConfig });

    const getRedirectResponse = (responsePath: string) =>
      getResponse({ responsePath, type: 'redirect', ...responseConfig });

    const getNextResponse = () =>
      getResponse({ type: 'next', ...responseConfig });

    if (localeRouting) {
      // ---------- GET PATHS ---------- //

      // get pathname
      const { pathname } = req.nextUrl;

      // standardize pathname (ie, /tg/welcome -> /fil/welcome), (/blog -> /blog)
      const standardizedPathname =
        pathnameLocale && pathnameLocale !== unstandardizedPathnameLocale
          ? pathname.replace(
              new RegExp(`^/${unstandardizedPathnameLocale}`),
              `/${pathnameLocale}`
            )
          : pathname;

      // Get the shared path for the unprefixed pathname
      const sharedPathMatch = getSharedPath(
        standardizedPathname,
        pathToSharedPath,
        pathnameLocale
      );
      const sharedPath = sharedPathMatch?.sharedPath;

      // Return early for a locale route that does not exist
      const localeRoutePathMap = localeRoutePathMaps.get(userLocale);
      if (userLocale !== resolvedDefaultLocale && localeRoutePathMap) {
        // Resolve the shared page path without a locale prefix (e.g. /blog/hello).
        // Strip the URL's locale, which may differ from the newly selected locale.
        const sharedPagePath = sharedPathMatch
          ? replaceDynamicSegments(
              sharedPathMatch.matchedPathname,
              sharedPath || '/',
              sharedPathMatch.pathTemplate
            )
          : (pathnameLocale
              ? standardizedPathname.slice(pathnameLocale.length + 1)
              : standardizedPathname) || '/';

        // If the path does not exist, redirect to the default locale path
        if (
          getSharedPath(sharedPagePath, localeRoutePathMap, undefined) ===
          undefined
        ) {
          // Get the path to redirect to
          const defaultPath =
            sharedPath !== undefined
              ? getLocalizedPath(sharedPath, defaultLocale, pathConfig)
              : undefined;
          const fallbackPath =
            defaultPath !== undefined && sharedPathMatch
              ? replaceDynamicSegments(
                  sharedPathMatch.matchedPathname,
                  defaultPath,
                  sharedPathMatch.pathTemplate
                )
              : `/${defaultLocale}${sharedPagePath === '/' ? '' : sharedPagePath}`;
          const defaultRoutingLocale = getRoutingLocale(resolvedDefaultLocale);
          const publicFallbackPath = applyTrailingSlash(
            standardizedPathname,
            prefixDefaultLocale
              ? `/${defaultRoutingLocale}${fallbackPath.slice(defaultLocale.length + 1)}`
              : fallbackPath.slice(defaultLocale.length + 1) || '/'
          );

          // The default locale is terminal, even if the preference/reset cookie
          // still requests an unavailable locale on the redirected request.
          userLocale = resolvedDefaultLocale;
          routingLocale = defaultRoutingLocale;
          responseConfig.userLocale = resolvedDefaultLocale;
          const fallbackUrl = new URL(req.nextUrl);
          fallbackUrl.pathname = publicFallbackPath;
          if (fallbackUrl.pathname !== pathname) {
            return getRedirectResponse(publicFallbackPath);
          }
          // Already at the fallback URL: use normal default-locale routing below,
          // including its alias/override rewrite, instead of redirecting to itself.
        }
      }

      // Get shared path with parameters (/en/dashboard/1/custom), for rewriting localized paths
      const sharedPathWithParameters =
        sharedPathMatch !== undefined
          ? applyTrailingSlash(
              standardizedPathname,
              replaceDynamicSegments(
                sharedPathMatch.matchedPathname,
                `/${routingLocale}${sharedPath}`,
                sharedPathMatch.pathTemplate
              )
            )
          : undefined;

      // Localized path (/en/blog, /fr/fr-about, /fr/dashboard/[id]/custom)
      const localizedPath =
        sharedPath !== undefined
          ? getLocalizedPath(sharedPath, userLocale, pathConfig)
          : undefined;

      // Combine localized path with dynamic parameters (/en/blog, /fr/fr-about, /fr/dashboard/1/fr-custom)
      const localizedPathWithParameters =
        localizedPath !== undefined && sharedPathMatch !== undefined
          ? applyTrailingSlash(
              standardizedPathname,
              replaceDynamicSegments(
                sharedPathMatch.matchedPathname,
                `/${routingLocale}${localizedPath.slice(userLocale.length + 1)}`,
                sharedPathMatch.pathTemplate
              )
            )
          : undefined;

      const pagePath =
        (sharedPathWithParameters?.slice(routingLocale.length + 1) ??
          (pathnameLocale
            ? standardizedPathname.slice(pathnameLocale.length + 1)
            : standardizedPathname)) ||
        '/';
      const routeOverridePathMap = routeOverridePathMaps[userLocale];
      const routeOverrideMatch = routeOverridePathMap
        ? getSharedPath(pagePath, routeOverridePathMap, undefined)
        : undefined;
      const routeOverridePath =
        routeOverrideMatch !== undefined
          ? applyTrailingSlash(
              standardizedPathname,
              `/${routingLocale}/${routingLocale}${pagePath === '/' ? '' : pagePath}`
            )
          : undefined;

      // ---------- ROUTING LOGIC ---------- //

      // ----- CASE: no localized path exists ----- //

      if (localizedPathWithParameters === undefined) {
        // --- CASE: remove defaultLocale prefix --- //

        if (!prefixDefaultLocale && userLocale === resolvedDefaultLocale) {
          if (pathnameLocale) {
            // REDIRECT CASE: used setLocale (/fr/customers -> /customers) (/en/customers -> /customers)
            if (clearResetCookie) {
              return getRedirectResponse(
                pathname.replace(
                  new RegExp(`^/${unstandardizedPathnameLocale}`),
                  ``
                ) || '/'
              );
            }
          } else {
            // REWRITE CASE: no pathnameLocale (/customers -> /en/customers)
            return getRewriteResponse(
              routeOverridePath || `/${routingLocale}${pathname}`
            );
          }
        }

        // --- CASE: defaultLocale prefix --- //
        // REDIRECT CASE: no pathnameLocale (ie, /customers -> /fr/customers)
        else if (!pathnameLocale) {
          return getRedirectResponse(`/${routingLocale}${pathname}`);
        }

        // REDIRECT CASE: wrong pathnameLocale (ie, /fr/customers -> /en/customers) (this usually happens after a locale switch)
        if (pathnameLocale && routingLocale !== unstandardizedPathnameLocale) {
          return getRedirectResponse(
            pathname.replace(
              new RegExp(`^/${unstandardizedPathnameLocale}`),
              `/${routingLocale}`
            )
          );
        }

        // BASE CASE: has pathnameLocale and it's correct
        if (routeOverridePath) {
          return getRewriteResponse(routeOverridePath);
        }
        return getNextResponse();
      }

      // ----- CASE: localized path exists ----- //

      if (!prefixDefaultLocale && userLocale === resolvedDefaultLocale) {
        // --- CASE: remove defaultLocale prefix --- //

        if (pathnameLocale) {
          // REDIRECT CASE: remove locale prefix when setLocale is used (/en/blog -> /blog) (/fr/fr-about -> /en-about)
          if (clearResetCookie) {
            return getRedirectResponse(
              localizedPathWithParameters.replace(
                new RegExp(`^/${routingLocale}`),
                ``
              ) || '/'
            );
          }
        } else {
          const localizedPublicPath =
            localizedPathWithParameters.replace(
              new RegExp(`^/${routingLocale}`),
              ''
            ) || '/';

          // REDIRECT CASE: unprefixed pathname is wrong (/about -> /en-about)
          if (
            !pathnameLocale &&
            normalizePathname(localizedPublicPath) !==
              normalizePathname(pathname)
          ) {
            return getRedirectResponse(localizedPublicPath);
          }

          // REWRITE CASE: displaying correct path (/blog -> /en/blog)
          return getRewriteResponse(
            routeOverridePath || (sharedPathWithParameters as string)
          );
        }
      }

      // --- CASE: add defaultLocale prefix --- //

      // REDIRECT CASE: incorrect pathnameLocale
      if (
        normalizePathname(pathname) !==
        normalizePathname(localizedPathWithParameters)
      ) {
        return getRedirectResponse(localizedPathWithParameters);
      }

      if (routeOverridePath) {
        return getRewriteResponse(routeOverridePath);
      }

      // REWRITE CASE: displaying correct localized path, which is the same as the shared path (/fil/blog => /fil/blog) (/fr/fr-dashboard/1/fr-custom => /fr/dashboard/1/custom)
      // Next.js route identity preserves Unicode spelling, even when lookup
      // considers the public alias and shared path canonically equivalent.
      const rewriteUrl = new URL(
        sharedPathWithParameters as string,
        req.nextUrl
      );
      if (
        req.nextUrl.pathname !== rewriteUrl.pathname // no rewrite needed if it's already the shared path
      ) {
        // convert to shared path with dynamic parameters
        return getRewriteResponse(sharedPathWithParameters as string);
      }
    }

    // BASE CASE
    return getNextResponse();
  }

  return middleware;
}
