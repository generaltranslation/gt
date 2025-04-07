import {
  isValidLocale,
  standardizeLocale,
  isSameDialect,
} from 'generaltranslation';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { createUnsupportedLocalesWarning } from '../errors/createErrors';
import { NextRequest } from 'next/server';
import {
  defaultLocaleRoutingEnabledCookieName,
  defaultReferrerLocaleCookieName,
  defaultResetLocaleCookieName,
} from '../utils/cookies';
import { defaultLocaleCookieName } from 'gt-react/internal';
import {
  PathConfig,
  getSharedPath,
  replaceDynamicSegments,
  getLocalizedPath,
  createPathToSharedPathMap,
  getLocaleFromRequest,
  getResponse,
} from './utils';
import { defaultLocaleHeaderName } from '../utils/headers';

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
 * @returns {function} - A middleware function that processes the request and response.
 */
export default function createNextMiddleware({
  localeRouting = true,
  prefixDefaultLocale = false,
  pathConfig = {},
}: {
  localeRouting?: boolean;
  prefixDefaultLocale?: boolean;
  pathConfig?: PathConfig;
} = {}) {
  // i18n config
  let envParams;
  if (process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS) {
    try {
      envParams = JSON.parse(
        process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS
      );
    } catch (error) {
      console.error(`gt-next middleware:`, error);
    }
  }

  // using gt services
  const gtServicesEnabled =
    process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED === 'true';

  // i18n config
  const defaultLocale: string =
    envParams?.defaultLocale || libraryDefaultLocale;
  const locales: string[] = envParams?.locales || [defaultLocale];

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

  if (!isValidLocale(defaultLocale))
    throw new Error(
      `gt-next middleware: defaultLocale "${defaultLocale}" is not a valid locale.`
    );

  const warningLocales = locales.filter((locale) => !isValidLocale(locale));
  if (warningLocales.length)
    console.warn(createUnsupportedLocalesWarning(warningLocales));

  const approvedLocales = locales;

  // ---------- PRE-PROCESSING PATHS ---------- //

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

  // Create the path mapping
  const { pathToSharedPath, defaultLocalePaths } = createPathToSharedPathMap(
    pathConfig,
    prefixDefaultLocale,
    defaultLocale
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
  function nextMiddleware(req: NextRequest) {
    // ---------- LOCALE DETECTION ---------- //

    const {
      userLocale,
      pathnameLocale,
      unstandardizedPathnameLocale,
      clearResetCookie,
    } = getLocaleFromRequest(
      req,
      defaultLocale,
      approvedLocales,
      localeRouting,
      gtServicesEnabled,
      prefixDefaultLocale,
      defaultLocalePaths,
      referrerLocaleCookieName,
      localeCookieName,
      resetLocaleCookieName
    );

    const headerList = new Headers(req.headers);

    const responseConfig = {
      originalUrl: req.nextUrl,
      headerList,
      userLocale,
      clearResetCookie,
      localeRouting,
      localeRoutingEnabledCookieName,
      localeCookieName,
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
              `/${userLocale}`
            )
          : pathname;

      // Get the shared path for the unprefixed pathname
      const sharedPath = getSharedPath(
        standardizedPathname,
        pathToSharedPath,
        pathnameLocale
      );

      // Get shared path with parameters (/en/dashboard/1/custom), for rewriting localized paths
      const sharedPathWithParameters =
        sharedPath !== undefined
          ? replaceDynamicSegments(
              pathnameLocale
                ? standardizedPathname
                : `/${userLocale}${standardizedPathname}`,
              `/${userLocale}${sharedPath}`
            )
          : undefined;

      // Localized path (/en/blog, /fr/fr-about, /fr/dashboard/[id]/custom)
      const localizedPath =
        sharedPath !== undefined
          ? getLocalizedPath(sharedPath, userLocale, pathConfig)
          : undefined;

      // Combine localized path with dynamic parameters (/en/blog, /fr/fr-about, /fr/dashboard/1/fr-custom)
      const localizedPathWithParameters =
        localizedPath !== undefined
          ? replaceDynamicSegments(
              pathnameLocale
                ? standardizedPathname
                : `/${userLocale}${standardizedPathname}`,
              localizedPath
            )
          : undefined;

      // ---------- ROUTING LOGIC ---------- //

      // ----- CASE: no localized path exists ----- //

      if (localizedPathWithParameters === undefined) {
        // --- CASE: remove defaultLocale prefix --- //

        if (!prefixDefaultLocale && isSameDialect(userLocale, defaultLocale)) {
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
            return getRewriteResponse(`/${userLocale}${pathname}`);
          }
        }

        // --- CASE: defaultLocale prefix --- //

        // REDIRECT CASE: no pathnameLocale (ie, /customers -> /fr/customers)
        else if (!pathnameLocale) {
          return getRedirectResponse(`/${userLocale}${pathname}`);
        }

        // REDIRECT CASE: wrong pathnameLocale (ie, /fr/customers -> /en/customers) (this usually happens after a locale switch)
        if (pathnameLocale && userLocale !== unstandardizedPathnameLocale) {
          return getRedirectResponse(
            pathname.replace(
              new RegExp(`^/${unstandardizedPathnameLocale}`),
              `/${userLocale}`
            )
          );
        }

        // BASE CASE: has pathnameLocale and it's correct
        return getNextResponse();
      }

      // ----- CASE: localized path exists ----- //

      if (!prefixDefaultLocale && isSameDialect(userLocale, defaultLocale)) {
        // --- CASE: remove defaultLocale prefix --- //

        if (pathnameLocale) {
          // REDIRECT CASE: remove locale prefix when setLocale is used (/en/blog -> /blog) (/fr/fr-about -> /en-about)
          if (clearResetCookie) {
            return getRedirectResponse(
              localizedPathWithParameters.replace(
                new RegExp(`^/${unstandardizedPathnameLocale}`),
                ``
              ) || '/'
            );
          }
        } else {
          // REDIRECT CASE: unprefixed pathname is wrong (/about -> /en-about)
          if (
            !pathnameLocale &&
            localizedPathWithParameters !== `/${userLocale}${pathname}`
          ) {
            return getRedirectResponse(
              localizedPathWithParameters.replace(
                new RegExp(`^/${userLocale}`),
                ''
              ) || '/'
            );
          }

          // REWRITE CASE: displaying correct path (/blog -> /en/blog)
          return getRewriteResponse(sharedPathWithParameters as string);
        }
      }

      // --- CASE: add defaultLocale prefix --- //

      // REDIRECT CASE: incorrect pathnameLocale
      if (pathname !== localizedPathWithParameters) {
        return getRedirectResponse(localizedPathWithParameters);
      }

      // REWRITE CASE: displaying correct localized path, which is the same as the shared path (/fil/blog => /fil/blog) (/fr/fr-dashboard/1/fr-custom => /fr/dashboard/1/custom)
      if (
        standardizedPathname !== sharedPathWithParameters // no rewrite needed if it's already the shared path
      ) {
        // convert to shared path with dynamic parameters
        return getRewriteResponse(sharedPathWithParameters as string);
      }
    }

    // BASE CASE
    return getNextResponse();
  }

  return nextMiddleware;
}
