import {
  isValidLocale,
  determineLocale,
  standardizeLocale,
  isSameDialect,
} from 'generaltranslation';
import {
  libraryDefaultLocale,
  localeCookieName,
  localeHeaderName,
  localeRewriteFlagName,
} from 'generaltranslation/internal';
import { listSupportedLocales } from '@generaltranslation/supported-locales';
import { createUnsupportedLocalesWarning } from '../errors/createErrors';
import { NextResponse } from 'next/server';

/**
 * Extracts the locale from the given pathname.
 *
 * @param {string} pathname - The pathname to extract from.
 * @returns {string} The extracted locale.
 */
function extractLocale(pathname: string): string | null {
  const matches = pathname.match(/^\/([^\/]+)(?:\/|$)/);
  return matches ? matches[1] : null;
}

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
export default function createNextMiddleware(
  {
    localeRouting = true,
    prefixDefaultLocale = false,
  }: {
    localeRouting?: boolean;
    prefixDefaultLocale?: boolean;
  } = {
    localeRouting: true,
    prefixDefaultLocale: false,
  }
) {
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

  type PathConfig = {
    [key: string]: string | { [key: string]: string };
  };
  const pathConfig: PathConfig = {
    '/blog': '/blog',
    '/about': {
      fr: '/le-about',
    },
  };

  // maps localized paths to shared paths
  const pathToSharedPath: Record<string, string> = Object.entries(
    pathConfig
  ).reduce<Record<string, string>>((acc, [sharedPath, localizedPath]) => {
    acc[sharedPath] = sharedPath;
    if (typeof localizedPath === 'object') {
      Object.values(localizedPath).forEach((localizedPath) => {
        acc[localizedPath] = sharedPath;
      });
    }
    return acc;
  }, {});
  console.log('pathToSharedPath', pathToSharedPath);

  /**
   * Gets the full localized path given a shared path and locale
   * @param sharedPath
   * @param locale
   * @returns localized path or undefined if no localized path is found
   *
   * const pathConfig = {
   *   '/blog': '/blog',
   *   '/about': {
   *     fr: '/le-about',
   *   },
   * }
   *
   * // exact matches returns full localized path
   * getLocalizedPath('/about', 'en-US') -> '/en-US/about'
   * getLocalizedPath('/about', 'fr') -> '/fr/le-about'
   * getLocalizedPath('/about', 'es') -> '/es/about
   * getLocalizedPath('/blog', 'en-US') -> '/en-US/blog'
   *
   * // non-shared paths return undefined
   * getLocalizedPath('/foo', 'en-US') -> undefined
   */
  const getLocalizedPath = (
    sharedPath: string,
    locale: string
  ): string | undefined => {
    const localizedPath = pathConfig[sharedPath];
    if (typeof localizedPath === 'string') return `/${locale}${localizedPath}`;
    else if (typeof localizedPath === 'object')
      return localizedPath[locale]
        ? `/${locale}${localizedPath[locale]}`
        : `/${locale}${sharedPath}`;
    return undefined;
  };

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
   * @param {any} req - The incoming request object, containing URL and headers.
   * @returns {NextResponse} - The Next.js response, either continuing the request or redirecting to the localized URL.
   */
  function nextMiddleware(req: any) {
    console.log('--------------------------------');
    const headerList = new Headers(req.headers);

    const res = NextResponse.next();

    const candidates = [];

    // routing
    let routingConfig;
    try {
      routingConfig = require('gt-next/_routing');
    } catch (e) {
      console.error(e);
    }

    const rewriteFlag = req.headers.get(localeRewriteFlagName) === 'true';

    // ---------- LOCALE DETECTION ---------- //

    // Check pathname locales
    let pathnameLocale;
    const { pathname } = req.nextUrl;
    if (localeRouting) {
      // Check if there is any supported locale in the pathname
      const extractedLocale = standardizeLocale(extractLocale(pathname) || '');
      if (isValidLocale(extractedLocale)) {
        pathnameLocale = extractedLocale;
        candidates.push(pathnameLocale);
      }
    }

    // Check cookie locale
    const cookieLocale = req.cookies.get(localeCookieName);
    if (isValidLocale(cookieLocale?.value)) {
      const resetCookieName = 'generaltranslation.locale.reset';
      const resetCookie = req.cookies.get(resetCookieName);
      if (resetCookie?.value) {
        res.cookies.delete(resetCookieName);
        candidates.unshift(cookieLocale.value);
      } else {
        candidates.push(cookieLocale.value);
      }
    }

    let refererLocale;
    if (localeRouting) {
      // If there's no locale, try to get one from the referer
      const referer = headerList.get('referer');
      if (referer && typeof referer === 'string') {
        refererLocale = extractLocale(new URL(referer)?.pathname);
        if (isValidLocale(refererLocale || ''))
          candidates.push(refererLocale || '');
      }
    }

    // Get locales from accept-language header
    const acceptedLocales =
      headerList
        .get('accept-language')
        ?.split(',')
        .map((item) => item.split(';')?.[0].trim()) || [];
    candidates.push(...acceptedLocales);

    // Get default locale
    candidates.push(defaultLocale);

    // determine userLocale
    const userLocale = standardizeLocale(
      determineLocale(candidates.filter(isValidLocale), approvedLocales) ||
        defaultLocale
    );
    console.log('userLocale', userLocale);
    res.headers.set(localeHeaderName, userLocale);

    if (userLocale) {
      res.cookies.set('generaltranslation.middleware.locale', userLocale);
    }

    // ---------- ROUTING ---------- //

    if (localeRouting) {
      const { pathname } = req.nextUrl;
      // Only strip off the locale if it's a valid locale
      const unprefixedPathname = pathnameLocale
        ? pathname.replace(new RegExp(`^/${pathnameLocale}`), '')
        : pathname;
      const originalUrl = req.nextUrl;
      const sharedPath = pathToSharedPath[unprefixedPathname];
      const localizedPath =
        sharedPath && getLocalizedPath(sharedPath, userLocale);
      console.log('pathname', pathname);
      console.log('sharedPath', sharedPath);
      console.log('localizedPath', localizedPath);

      // BASE CASE: same locale, same path (/en-US/blog -> /en-US/blog)
      if (
        pathname === localizedPath &&
        localizedPath === `/${userLocale}${sharedPath}`
      ) {
        console.log('DO NOTHING: ', userLocale, pathname);
        return res;
      }

      // REWRITE CASE: proxies a localized path, same locale (/fr/le-about => /fr/about)
      if (pathname === localizedPath) {
        const rewritePath = `/${userLocale}${sharedPath}`;
        const rewriteUrl = new URL(rewritePath, originalUrl);
        rewriteUrl.search = originalUrl.search;
        res.headers.set(localeRewriteFlagName, 'true');
        console.log(
          'REWRITE (localized path, same locale):',
          userLocale,
          pathnameLocale,
          '\n' + pathname,
          '->',
          rewritePath
        );
        const response = NextResponse.rewrite(rewriteUrl, req.url);
        if (userLocale) {
          response.cookies.set(
            'generaltranslation.middleware.locale',
            userLocale
          );
        }
        return response;
      }

      // REDIRECT CASE: non-i18n path
      // 1. use customized path if it exists                      (/en-US/about -> /fr/le-about), (/about -> /fr/le-about)
      // 2. otherwise, if pathname has locale prefix, replace it  (/en-US/welcome -> /fr/welcome)
      // 3. otherwise, prefix with locale                         (/welcome -> /fr/welcome)
      if (pathnameLocale !== userLocale) {
        // determine redirect path
        const redirectPath =
          localizedPath ||
          (pathnameLocale
            ? pathname.replace(
                new RegExp(`^/${pathnameLocale}`),
                `/${userLocale}`
              )
            : `/${userLocale}${pathname}`);
        const redirectUrl = new URL(redirectPath, originalUrl);
        redirectUrl.search = originalUrl.search;
        console.log(
          'REDIRECT (unknown path):',
          userLocale,
          pathnameLocale,
          '\n' + pathname,
          '->',
          redirectPath
        );
        const response = NextResponse.redirect(redirectUrl);
        if (userLocale) {
          response.cookies.set(
            'generaltranslation.middleware.locale',
            userLocale
          );
        }
        return response;
      }

      // REDIRECT CASE: mismatched localized path (i.e. /fr/about -> /fr/le-about)
      if (localizedPath && !rewriteFlag) {
        const redirectUrl = new URL(localizedPath, originalUrl);
        redirectUrl.search = originalUrl.search;
        console.log(
          'REDIRECT (mismatched localized path):',
          userLocale,
          pathnameLocale,
          '\n' + pathname,
          '->',
          localizedPath
        );
        const response = NextResponse.redirect(redirectUrl);
        if (userLocale) {
          response.cookies.set(
            'generaltranslation.middleware.locale',
            userLocale
          );
        }
        return response;
      }

      // BASE CASE
      console.log('DO NOTHING:', userLocale, pathname);
      return res;
    }

    return res;
  }

  return nextMiddleware;
}
