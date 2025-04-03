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
  getResponse,
  ResponseConfig,
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

    const headerList = new Headers(req.headers);

    const responseConfig = {
      originalUrl: req.nextUrl,
      headerList,
      userLocale,
      clearResetCookie,
      localeRouting,
    };

    const getRewriteResponse = (responsePath: string) =>
      getResponse({ responsePath, type: 'rewrite', ...responseConfig });

    const getRedirectResponse = (responsePath: string) =>
      getResponse({ responsePath, type: 'redirect', ...responseConfig });

    const getNextResponse = () =>
      getResponse({ type: 'next', ...responseConfig });

    // const res = NextResponse.next({
    //   request: {
    //     // New request headers
    //     headers: headerList,
    //   },
    // });
    // res.headers.set(localeHeaderName, userLocale);
    // res.cookies.set(middlewareLocaleRoutingFlagName, localeRouting.toString());
    // if (clearResetCookie) {
    //   res.cookies.delete(middlewareLocaleResetFlagName);
    // }

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
      const sharedPath = getSharedPath(standardizedPathname, pathToSharedPath);

      // Get shared path with parameters (/en/dashboard/1/custom)
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

      console.log('pathname:                     %s', pathname);
      console.log(
        'unstandardizedPathnameLocale: %s',
        unstandardizedPathnameLocale
      );
      console.log('pathnameLocale:               %s', pathnameLocale);
      console.log('standardizedPathname:         %s', standardizedPathname);
      console.log();
      console.log('userLocale:                   %s', userLocale);
      console.log();
      console.log('sharedPath:                   %s', sharedPath);
      console.log('sharedPathWithParameters:     %s', sharedPathWithParameters);
      console.log();
      console.log('localizedPath:                %s', localizedPath);
      console.log(
        'localizedPathWithParameters:  %s',
        localizedPathWithParameters
      );

      console.log('[MIDDLEWARE] locale', userLocale);

      console.log('--------------------------------');

      // ---------- ROUTING LOGIC ---------- //

      // ----- CASE: no localized path exists ----- //

      if (localizedPathWithParameters === undefined) {
        // --- CASE: remove defaultLocale prefix --- //

        if (!prefixDefaultLocale && isSameDialect(userLocale, defaultLocale)) {
          // REDIRECT CASE: pathname locale is wrong (/fr/customers -> /customers) (this usually happens after a locale switch)
          if (pathnameLocale && userLocale !== unstandardizedPathnameLocale) {
            return getRedirectResponse(
              pathname.replace(
                new RegExp(`^/${unstandardizedPathnameLocale}`),
                ''
              )
            );
          }

          // REWRITE CASE: no pathnameLocale (/customers -> /en/customers)
          if (!pathnameLocale) {
            return getRewriteResponse(`/${userLocale}${pathname}`);
          }
        } else {
          // --- CASE: add defaultLocale prefix --- //

          // REDIRECT CASE: wrong pathnameLocale (ie, /fr/customers -> /en/customers) (this usually happens after a locale switch)
          if (pathnameLocale && userLocale !== unstandardizedPathnameLocale) {
            return getRedirectResponse(
              pathname.replace(
                new RegExp(`^/${unstandardizedPathnameLocale}`),
                `/${userLocale}`
              )
            );
          }

          // REDIRECT CASE: no pathnameLocale (ie, /customers -> /fr/customers)
          if (!pathnameLocale) {
            return getRedirectResponse(`/${userLocale}${pathname}`);
          }
        }

        // BASE CASE: has pathnameLocale and it's correct
        return getNextResponse();
      }

      // ----- CASE: localized path exists ----- //

      if (!prefixDefaultLocale && isSameDialect(userLocale, defaultLocale)) {
        // --- CASE: remove defaultLocale prefix --- //

        // REDIRECT CASE: unprefixed pathname is wrong (/about -> /en-about) (/dashboard/1/custom -> /en-dashboard/1/en-custom)
        // REDIRECT CASE: pathname is wrong (/fr/blog -> /blog) (/fr/fr-about -> /en-about)
        if (
          (!pathnameLocale &&
            localizedPathWithParameters !== `/${userLocale}${pathname}`) ||
          (pathnameLocale && localizedPathWithParameters !== pathname)
        ) {
          // remove locale prefix
          return getRedirectResponse(
            localizedPathWithParameters.replace(
              new RegExp(`^/${userLocale}`),
              ''
            )
          );
        }

        // REWRITE CASE: displaying correct path (/blog -> /en/blog) (/en-dashboard/1/en-custom -> /en/dashboard/1/custom) (/en-about -> /en/about)
        // shared path with dynamic parameters
        return getRewriteResponse(
          replaceDynamicSegments(
            pathnameLocale
              ? standardizedPathname
              : `/${userLocale}${standardizedPathname}`,
            `/${userLocale}${sharedPath}`
          )
        );
      }

      // --- CASE: add defaultLocale prefix --- //

      // REDIRECT CASE: path is missing prefix (ie, /blog -> /en/blog) (/dashboard -> /fr/fr-dashboard)
      // REDIRECT CASE: wrong path (invalid path) (/fr/about -> /fr/fr-about) (NOT: /en/fr-about -> /en/en-about, /en/fr-about should 404)
      if (!pathnameLocale || localizedPathWithParameters !== pathname) {
        return getRedirectResponse(localizedPathWithParameters);
      }

      // REWRITE CASE: displaying correct path at localized path, which is the same as the shared path (/fil/blog => /fil/blog) (/fr/fr-dashboard/1/fr-custom => /fr/dashboard/1/custom)
      if (
        sharedPathWithParameters !== undefined &&
        standardizedPathname === localizedPathWithParameters && // we are displaying the correct path
        standardizedPathname !== sharedPathWithParameters // no rewrite needed if it's already the shared path
      ) {
        // convert to shared path with dynamic parameters
        return getRewriteResponse(sharedPathWithParameters);
      }
    }

    // BASE CASE
    return getNextResponse();
  }

  return nextMiddleware;
}
