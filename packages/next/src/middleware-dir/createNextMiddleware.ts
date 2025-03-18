import {
  isValidLocale,
  standardizeLocale,
  isSameDialect,
} from 'generaltranslation';
import {
  libraryDefaultLocale,
  localeHeaderName,
} from 'generaltranslation/internal';
import { createUnsupportedLocalesWarning } from '../errors/createErrors';
import { NextRequest, NextResponse } from 'next/server';
import {
  middlewareLocaleName,
  middlewareLocaleResetFlagName,
} from '../utils/constants';
import {
  PathConfig,
  getSharedPath,
  replaceDynamicSegments,
  getLocalizedPath,
  createPathToSharedPathMap,
  getLocaleFromRequest,
} from './utils';

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
}) {
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
  const pathToSharedPath = createPathToSharedPathMap(pathConfig);
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
    const headerList = new Headers(req.headers);

    const res = NextResponse.next({
      request: {
        // New request headers
        headers: headerList,
      },
    });

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
      gtServicesEnabled
    );

    res.headers.set(localeHeaderName, userLocale);

    res.cookies.set(middlewareLocaleName, userLocale);

    if (clearResetCookie) {
      res.cookies.delete(middlewareLocaleResetFlagName);
    }

    if (localeRouting) {
      // ---------- GET PATHS ---------- //

      const { pathname } = req.nextUrl;
      // Only strip off the locale if it's a valid locale (/fr/fr-about -> /about), (/blog -> /blog)
      const unprefixedPathname = pathnameLocale
        ? pathname.replace(new RegExp(`^/${unstandardizedPathnameLocale}`), '')
        : pathname;
      const originalUrl = req.nextUrl;

      // standardize pathname (ie, /tg/welcome -> /fil/welcome), (/blog -> /blog)
      const standardizedPathname =
        pathnameLocale && pathnameLocale !== unstandardizedPathnameLocale
          ? pathname.replace(
              new RegExp(`^/${unstandardizedPathnameLocale}`),
              `/${userLocale}`
            )
          : pathname;

      // Get the shared path for the unprefixed pathname
      const sharedPath = getSharedPath(unprefixedPathname, pathToSharedPath);

      // Localized path (/en-US/blog, /fr/fr-about, /fr/dashboard/[id]/custom)
      const localizedPath =
        sharedPath && getLocalizedPath(sharedPath, userLocale, pathConfig);

      // Combine localized path with dynamic parameters (/en-US/blog, /fr/fr-about, /fr/dashboard/1/fr-custom)
      const localizedPathWithParameters =
        localizedPath &&
        replaceDynamicSegments(
          pathnameLocale
            ? standardizedPathname
            : `/${userLocale}${standardizedPathname}`,
          localizedPath
        );

      // ---------- ROUTING LOGIC ---------- //

      // BASE CASE: default locale, same path (/en-US/blog -> /en-US/blog), (/en-US/dashboard/1/custom -> /en-US/dashboard/1/custom)
      if (
        localizedPathWithParameters &&
        standardizedPathname === localizedPathWithParameters &&
        userLocale === defaultLocale
      ) {
        return res;
      }

      // BASE CASE: at localized path, which is the same as the shared path (/fil/blog -> /fil/blog)
      if (
        pathname === localizedPathWithParameters &&
        `/${userLocale}${sharedPath}` === localizedPathWithParameters
      ) {
        return res;
      }

      // REWRITE CASE: proxies a localized path, same locale (/fr/fr-about => /fr/about) (/fr/dashboard/1/fr-custom => /fr/dashboard/1/custom)
      if (
        localizedPathWithParameters &&
        standardizedPathname === localizedPathWithParameters
      ) {
        // convert to shared path with dynamic parameters
        const rewritePath = replaceDynamicSegments(
          localizedPathWithParameters,
          `/${userLocale}${sharedPath}`
        );
        const rewriteUrl = new URL(rewritePath, originalUrl);
        rewriteUrl.search = originalUrl.search;
        headerList.set(localeHeaderName, userLocale);
        const response = NextResponse.rewrite(rewriteUrl, {
          headers: headerList,
        });
        response.headers.set(localeHeaderName, userLocale);
        response.cookies.set(middlewareLocaleName, userLocale);
        if (clearResetCookie) {
          response.cookies.delete(middlewareLocaleResetFlagName);
        }
        return response;
      }

      // REWRITE CASE: no locale prefix
      if (
        !pathnameLocale &&
        !prefixDefaultLocale &&
        isSameDialect(userLocale, defaultLocale)
      ) {
        const rewritePath = `/${userLocale}${pathname}`;
        const rewriteUrl = new URL(rewritePath, originalUrl);
        rewriteUrl.search = originalUrl.search;
        const response = NextResponse.rewrite(rewriteUrl, {
          headers: headerList,
        });
        response.headers.set(localeHeaderName, userLocale);
        response.cookies.set(middlewareLocaleName, userLocale);
        if (clearResetCookie) {
          response.cookies.delete(middlewareLocaleResetFlagName);
        }
        return response;
      }

      // REDIRECT CASE: non-i18n path
      // 1. use customized path if it exists                      (/en-US/about -> /fr/fr-about), (/about -> /fr/fr-about)
      // 2. otherwise, if pathname has locale prefix, replace it  (/en-US/welcome -> /fr/welcome)
      // 3. otherwise, prefix with locale                         (/welcome -> /fr/welcome)
      if (unstandardizedPathnameLocale !== userLocale) {
        // determine redirect path
        const redirectPath =
          localizedPathWithParameters ||
          (pathnameLocale
            ? pathname.replace(
                new RegExp(`^/${unstandardizedPathnameLocale}`),
                `/${userLocale}`
              )
            : `/${userLocale}${pathname}`);
        const redirectUrl = new URL(redirectPath, originalUrl);
        redirectUrl.search = originalUrl.search;
        const response = NextResponse.redirect(redirectUrl);
        response.cookies.set(middlewareLocaleName, userLocale);
        if (clearResetCookie) {
          response.cookies.delete(middlewareLocaleResetFlagName);
        }
        return response;
      }

      // REDIRECT CASE: mismatched localized path (/fr/about -> /fr/fr-about), mismatched dynamic path (/fr/dashboard/1/custom -> /fr/dashboard/1/fr-custom)
      if (localizedPathWithParameters) {
        const redirectUrl = new URL(localizedPathWithParameters, originalUrl);
        redirectUrl.search = originalUrl.search;
        const response = NextResponse.redirect(redirectUrl);
        response.cookies.set(middlewareLocaleName, userLocale);
        if (clearResetCookie) {
          response.cookies.delete(middlewareLocaleResetFlagName);
        }
        return response;
      }

      // BASE CASE
      return res;
    }

    return res;
  }

  return nextMiddleware;
}
