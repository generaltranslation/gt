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
  middlewareLocaleResetFlagName,
  middlewareLocaleRoutingFlagName,
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
    console.log('--------------------------------');
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
      gtServicesEnabled,
      prefixDefaultLocale,
      defaultLocalePaths
    );

    res.headers.set(localeHeaderName, userLocale);
    res.cookies.set(middlewareLocaleRoutingFlagName, localeRouting.toString());
    if (clearResetCookie) {
      res.cookies.delete(middlewareLocaleResetFlagName);
    }

    if (localeRouting) {
      // ---------- GET PATHS ---------- //

      // get pathname
      const { pathname } = req.nextUrl;
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
      const sharedPath = getSharedPath(standardizedPathname, pathToSharedPath);

      // Get shared path with parameters (/en/dashboard/1/custom)
      const sharedPathWithParameters = replaceDynamicSegments(
        pathnameLocale
          ? standardizedPathname
          : `/${userLocale}${standardizedPathname}`,
        `/${userLocale}${sharedPath}`
      );

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

      console.log('........');
      console.log('[MIDDLEWARE] userLocale', userLocale);
      console.log('[MIDDLEWARE] pathnameLocale', pathnameLocale);
      console.log(
        '[MIDDLEWARE] unstandardizedPathnameLocale',
        unstandardizedPathnameLocale
      );
      console.log('........');
      console.log('[MIDDLEWARE] pathname', pathname);
      console.log(
        '[MIDDLEWARE] localizedPathWithParameters',
        localizedPathWithParameters
      );
      console.log('........');

      // ---------- ROUTING LOGIC ---------- //

      // CASE: no localized path exists
      if (!localizedPathWithParameters) {
        // CASE: path locale is valid
        if (pathnameLocale) {
          // BASE CASE: no localized path exists, so no change
          if (userLocale === unstandardizedPathnameLocale) {
            console.log(
              `[MIDDLEWARE] BASE CASE: no localized path exists, so no change: ${pathname}`
            );
            return res;
          }

          // REDIRECT CASE: wrong pathname locale (/fr -> /en)
          const redirectPath = pathname.replace(
            new RegExp(`^/${unstandardizedPathnameLocale}`),
            `/${userLocale}`
          );
          const redirectUrl = new URL(redirectPath, originalUrl);
          redirectUrl.search = originalUrl.search;
          const response = NextResponse.redirect(redirectUrl);
          response.headers.set(localeHeaderName, userLocale);
          response.cookies.set(middlewareLocaleRoutingFlagName, 'true');
          // if (clearResetCookie) {
          //   response.cookies.delete(middlewareLocaleResetFlagName);
          // }
          console.log(
            `[MIDDLEWARE] REDIRECT CASE: wrong pathname locale: ${pathname} -> ${redirectPath}`
          );
          return response;
        }

        // REWRITE: no default locale prefix (/customers -> /en/customers)
        if (
          !pathnameLocale &&
          !prefixDefaultLocale &&
          isSameDialect(userLocale, defaultLocale)
        ) {
          const rewritePath = `/${defaultLocale}${pathname}`;
          const rewriteUrl = new URL(rewritePath, originalUrl);
          rewriteUrl.search = originalUrl.search;
          const response = NextResponse.rewrite(rewriteUrl, {
            headers: headerList,
          });
          response.headers.set(localeHeaderName, userLocale);
          response.cookies.set(middlewareLocaleRoutingFlagName, 'true');
          // if (clearResetCookie) {
          //   response.cookies.delete(middlewareLocaleResetFlagName);
          // }
          console.log(
            `[MIDDLEWARE] REWRITE CASE: no default locale prefix: ${pathname} -> ${rewritePath}`
          );
          return response;
        }

        // REDIRECT CASE: no/invalid pathnameLocale, add a default locale prefix
        const redirectPath = `/${userLocale}${pathname}`;
        const redirectUrl = new URL(redirectPath, originalUrl);
        redirectUrl.search = originalUrl.search;
        const response = NextResponse.redirect(redirectUrl);
        response.headers.set(localeHeaderName, userLocale);
        response.cookies.set(middlewareLocaleRoutingFlagName, 'true');
        // if (clearResetCookie) {
        //   response.cookies.delete(middlewareLocaleResetFlagName);
        // }
        console.log(
          `[MIDDLEWARE] REDIRECT CASE: no/invalid pathnameLocale, add a default locale prefix: ${pathname} -> ${redirectPath}`
        );
        return response;
      }

      // CASE: remove default locale prefix
      if (
        !pathnameLocale &&
        !prefixDefaultLocale &&
        isSameDialect(userLocale, defaultLocale)
      ) {
        // REDIRECT CASE: displaying wrong path, convert to non-prefixed localized path (/about -> /en-about) (/dashboard/1/custom -> /en-dashboard/1/en-custom)
        if (localizedPathWithParameters !== `/${defaultLocale}${pathname}`) {
          // remove locale prefix
          const redirectPath = localizedPathWithParameters.replace(
            new RegExp(`^/${userLocale}`),
            ''
          );
          const redirectUrl = new URL(redirectPath, originalUrl);
          redirectUrl.search = originalUrl.search;
          const response = NextResponse.redirect(redirectUrl);
          response.headers.set(localeHeaderName, userLocale);
          response.cookies.set(middlewareLocaleRoutingFlagName, 'true');
          if (clearResetCookie) {
            response.cookies.delete(middlewareLocaleResetFlagName);
          }
          console.log(
            `[MIDDLEWARE] REDIRECT CASE: displaying wrong path, convert to non-prefixed localized path: ${pathname} -> ${redirectPath}`
          );
          return response;
        }

        // REWRITE CASE: displaying correct path (/blog -> /en/blog) (/en-dashboard/1/en-custom -> /en/dashboard/1/custom) (/en-about -> /en/about)
        // shared path with dynamic parameters
        const rewritePath = replaceDynamicSegments(
          pathnameLocale
            ? standardizedPathname
            : `/${userLocale}${standardizedPathname}`,
          `/${userLocale}${sharedPath}`
        );
        const rewriteUrl = new URL(rewritePath, originalUrl);
        rewriteUrl.search = originalUrl.search;
        const response = NextResponse.rewrite(rewriteUrl, {
          headers: headerList,
        });
        response.headers.set(localeHeaderName, userLocale);
        response.cookies.set(middlewareLocaleRoutingFlagName, 'true');
        if (clearResetCookie) {
          response.cookies.delete(middlewareLocaleResetFlagName);
        }
        console.log(
          `[MIDDLEWARE] REWRITE CASE: displaying correct path: ${pathname} -> ${rewritePath}`
        );
        return response;
      }

      // REDIRECT CASE: no localization prefix (invalid path), redirect to a localized path (ie, /blog -> /en-US/blog) (/dashboard -> /fr/fr-dashboard)
      // REDIRECT CASE: locale prefix mismatch userLocale (invalid path), redirect to a localized path (ie, /en-US/blog -> /fr/blog) (/tl/dashboard -> /fil/tl-dashboard)
      // REDIRECT CASE: displayed path doesnt match localized path (invalid path) (/fr/about -> /fr/fr-about) (NOT: /en/fr-about -> /en/en-about, /en/fr-about should 404)
      if (
        !pathnameLocale ||
        unstandardizedPathnameLocale !== userLocale ||
        localizedPathWithParameters !== standardizedPathname
      ) {
        const redirectPath = localizedPathWithParameters;
        const redirectUrl = new URL(redirectPath, originalUrl);
        redirectUrl.search = originalUrl.search;
        const response = NextResponse.redirect(redirectUrl);
        response.headers.set(localeHeaderName, userLocale);
        response.cookies.set(middlewareLocaleRoutingFlagName, 'true');
        if (clearResetCookie) {
          response.cookies.delete(middlewareLocaleResetFlagName);
        }
        console.log(
          `[MIDDLEWARE] REDIRECT CASE: no localization prefix (invalid path), redirect to a localized path: ${pathname} -> ${redirectPath}`
        );
        return response;
      }

      // REWRITE CASE: displaying correct path at localized path, which is the same as the shared path (/fil/blog => /fil/blog) (/fr/fr-dashboard/1/fr-custom => /fr/dashboard/1/custom)
      if (
        standardizedPathname === localizedPathWithParameters && // we are displaying the correct path
        standardizedPathname !== sharedPathWithParameters // no rewrite needed if it's already the shared path
      ) {
        // convert to shared path with dynamic parameters
        const rewritePath = sharedPathWithParameters;
        const rewriteUrl = new URL(rewritePath, originalUrl);
        rewriteUrl.search = originalUrl.search;
        const response = NextResponse.rewrite(rewriteUrl, {
          headers: headerList,
        });
        response.headers.set(localeHeaderName, userLocale);
        response.cookies.set(middlewareLocaleRoutingFlagName, 'true');
        if (clearResetCookie) {
          response.cookies.delete(middlewareLocaleResetFlagName);
        }
        console.log(
          `[MIDDLEWARE] REWRITE CASE: displaying correct path at localized path, which is the same as the shared path: ${pathname} -> ${rewritePath}`
        );
        return response;
      }

      // BASE CASE
      console.log('[MIDDLEWARE] BASE CASE: no change', pathname);
    }
    return res;
  }

  return nextMiddleware;
}
