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
} from 'generaltranslation/internal';
import { createUnsupportedLocalesWarning } from '../errors/createErrors';
import { NextRequest, NextResponse } from 'next/server';
import {
  middlewareLocaleName,
  middlewareLocaleResetFlagName,
  middlewareLocaleRewriteFlagName,
} from '../utils/constants';

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

type PathConfig = {
  [key: string]: string | { [key: string]: string };
};

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

  // recursively build a tree for the shared path lookup
  const buildTree = (
    chunks: string[],
    sharedPath: string,
    node: PathToSharedPathTree
  ): PathToSharedPathTree => {
    // base case - if no more chunks, set the value and return
    if (chunks.length === 0) {
      node.value = sharedPath;
      return node;
    }

    // get the next chunk
    const chunk = chunks.shift();
    if (!chunk) return node;

    // Initialize children if undefined
    if (!node.children) {
      node.children = {};
    }

    // Handle dynamic segments by converting them to [*]
    const normalizedChunk = chunk.startsWith('[') ? '[*]' : chunk;

    // Create or get the child node
    const childNode = node.children[normalizedChunk] || {
      value: undefined,
      children: {},
    };

    // Recursively build the rest of the tree
    node.children[normalizedChunk] = buildTree(chunks, sharedPath, childNode);

    return node;
  };

  // maps localized paths to shared paths
  type PathToSharedPathTree = {
    value: string | undefined;
    children: { [key: string]: PathToSharedPathTree } | undefined;
  };
  type PathToSharedPath = {
    [key: string]: string | PathToSharedPathTree;
  };
  const pathToSharedPath: PathToSharedPath = Object.entries(pathConfig)
    // create a flat map of shared paths and their patterns
    .reduce<[string, string][]>(
      (acc, [sharedPath, localizedPath]) => {
        // Add the shared path itself
        acc.push([sharedPath, sharedPath]);

        if (typeof localizedPath === 'object') {
          Object.values(localizedPath).forEach((localizedPath) => {
            // Convert dynamic path pattern to regex
            const pattern = localizedPath.replace(/\[([^\]]+)\]/g, '[*]');
            // Only add each pattern once
            acc.push([pattern, sharedPath]);
          });
        }
        return acc;
      },
      [] as [string, string][]
    )
    // convert the flat map to a nested object for dynamic path matching
    .reduce<PathToSharedPath>((acc, [localizedPath, sharedPath]) => {
      // Nested pattern for dynamic params (the tree)
      if (localizedPath.includes('[')) {
        const chunks = localizedPath.replace(/^\//, '').split('/');
        if (chunks.length > 1) {
          acc[chunks[0]] = buildTree(
            chunks.slice(1),
            sharedPath,
            (acc[chunks[0]] as PathToSharedPathTree) || {}
          );
        } else {
          acc[localizedPath] = sharedPath;
        }
      } else {
        acc[localizedPath] = sharedPath;
      }
      return acc;
    }, {});

  /**
   * Gets the shared path from a given pathname, handling both static and dynamic paths
   * @param pathname The pathname to extract the shared path from
   * @returns The shared path or undefined if no match is found
   *
   * Example:
   * pathname: /fr/dashboard/1/le-custom
   * Returns: /dashboard/[id]/custom
   *
   * pathname: /fr/le-about
   * Returns: /about
   *
   * pathname: /fr/blog
   * Returns: /blog
   */
  const getSharedPath = (pathname: string): string | undefined => {
    // Try exact match first
    let sharedPath: string | PathToSharedPathTree = pathToSharedPath[pathname];
    if (typeof sharedPath === 'string') return sharedPath;

    // Try dynamic pattern match
    const paths = pathname.replace(/^\//, '').split('/');
    let result: PathToSharedPathTree | undefined = pathToSharedPath[
      paths[0]
    ] as PathToSharedPathTree | undefined;
    for (const path of paths.slice(1)) {
      // if we have a children object, then we continue traversing
      let next: PathToSharedPathTree | undefined = result?.children?.[path]; // check for dynamic pattern
      if (!next?.value && Object.keys(result?.children || {}).includes('[*]')) {
        next = result?.children?.['[*]' as string];
      }
      result = next;
    }
    return result?.value;
  };

  /**
   * Extracts dynamic parameters from a path based on a shared path pattern
   * @param path The actual pathname containing values (includes locale prefix)
   * @param templatePath The shared path containing dynamic segments (does not include locale)
   * @returns Array of parameter values in order of appearance
   *
   * Example:
   * templatePath: /fr/dashboard/[id]/custom
   * path: /fr/dashboard/1/le-custom
   * Returns: ['1']
   *
   * Example with multiple params:
   * templatePath: /fr/dashboard/[id]/[type]/custom
   * path: /fr/dashboard/1/2/le-custom
   * Returns: ['1', '2']
   */
  const extractDynamicParams = (
    templatePath: string,
    path: string
  ): string[] => {
    if (!templatePath.includes('[')) return [];

    const params: string[] = [];
    const pathSegments = path.split('/');
    const sharedSegments = templatePath.split('/');

    sharedSegments.forEach((segment, index) => {
      if (segment.startsWith('[') && segment.endsWith(']')) {
        params.push(pathSegments[index]);
      }
    });

    return params;
  };

  /**
   * Replaces dynamic segments in a path with their actual values
   * @param path The original pathname containing actual values
   * @param templatePath The shared path containing dynamic segments
   * @returns The path with dynamic segments replaced with actual values
   *
   * Example:
   * path: /fr/dashboard/1/custom
   * templatePath: /fr/dashboard/[id]/le-custom
   * Returns: /fr/dashboard/1/le-custom
   *
   * Example:
   * path: /about
   * templatePath: /fr/le-about
   * Returns: /fr/le-about
   *
   * Note: This function only replaces dynamic segments (e.g. [id]) with their actual values.
   * It does not handle localized path parts (e.g. /custom vs /le-custom).
   */
  const replaceDynamicSegments = (
    path: string,
    templatePath: string
  ): string => {
    if (!templatePath.includes('[')) return templatePath;

    const params = extractDynamicParams(templatePath, path);
    let paramIndex = 0;
    return templatePath.replace(/\[([^\]]+)\]/g, (match: string) => {
      return params[paramIndex++] || match;
    });
  };

  /**
   * Gets the full localized path given a shared path and locale
   * @param sharedPath The shared path to localize
   * @param locale The locale to use
   * @param originalUrl Optional URL to preserve query parameters from
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
   * // with query parameters
   * getLocalizedPath('/about', 'fr', new URL('/about?foo=bar')) -> '/fr/le-about?foo=bar'
   *
   * // non-shared paths return undefined
   * getLocalizedPath('/foo', 'en-US') -> undefined
   */
  const getLocalizedPath = (
    sharedPath: string,
    locale: string
  ): string | undefined => {
    const localizedPath = pathConfig[sharedPath];
    let path: string | undefined;

    if (typeof localizedPath === 'string') {
      path = `/${locale}${localizedPath}`;
    } else if (typeof localizedPath === 'object') {
      path = localizedPath[locale]
        ? `/${locale}${localizedPath[locale]}`
        : `/${locale}${sharedPath}`;
    }

    return path;
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

    const candidates = [];

    // routing
    let routingConfig;
    try {
      routingConfig = require('gt-next/_routing');
    } catch (e) {
      console.error(e);
    }

    // Check for rewrite flag in cookies
    const rewriteFlag =
      req.headers.get(middlewareLocaleRewriteFlagName) === 'true';

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
    if (cookieLocale?.value && isValidLocale(cookieLocale?.value)) {
      const resetCookieName = middlewareLocaleResetFlagName;
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
    res.headers.set(localeHeaderName, userLocale);

    if (userLocale) {
      // TODO: make sure this is compatable with user changing browser langugage
      res.cookies.set(middlewareLocaleName, userLocale);
    }

    // ---------- ROUTING ---------- //

    if (localeRouting) {
      const { pathname } = req.nextUrl;
      // Only strip off the locale if it's a valid locale
      const unprefixedPathname = pathnameLocale
        ? pathname.replace(new RegExp(`^/${pathnameLocale}`), '')
        : pathname;
      const originalUrl = req.nextUrl;

      // Get the shared path for the unprefixed pathname
      const sharedPath = getSharedPath(unprefixedPathname);

      // Localized path (/en-US/blog, /fr/le-about, /fr/dashboard/[id]/custom)
      const localizedPath =
        sharedPath && getLocalizedPath(sharedPath, userLocale);

      // Combine localized path with dynamic parameters (/en-US/blog, /fr/le-about, /fr/dashboard/1/le-custom)
      const localizedPathWithParameters =
        localizedPath && replaceDynamicSegments(pathname, localizedPath);

      // BASE CASE: same locale, same path (/en-US/blog -> /en-US/blog), (/en-US/dashboard/1/custom -> /en-US/dashboard/1/custom)
      if (
        localizedPathWithParameters &&
        pathname === localizedPathWithParameters &&
        userLocale === defaultLocale
      ) {
        return res;
      }

      // If we've already rewritten this path, don't process it again
      if (rewriteFlag) {
        return res;
      }

      // REWRITE CASE: proxies a localized path, same locale (/fr/le-about => /fr/about)
      if (
        localizedPathWithParameters &&
        pathname === localizedPathWithParameters
      ) {
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
        response.headers.set(middlewareLocaleRewriteFlagName, 'true');
        if (userLocale) {
          response.cookies.set(middlewareLocaleName, userLocale);
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
        response.headers.set(middlewareLocaleRewriteFlagName, 'true');
        return response;
      }

      // REDIRECT CASE: non-i18n path
      // 1. use customized path if it exists                      (/en-US/about -> /fr/le-about), (/about -> /fr/le-about)
      // 2. otherwise, if pathname has locale prefix, replace it  (/en-US/welcome -> /fr/welcome)
      // 3. otherwise, prefix with locale                         (/welcome -> /fr/welcome)
      if (pathnameLocale !== userLocale) {
        // determine redirect path
        // TODO: check out standardizeLocale(extractLocale(pathname) || ''); TL which gets standardized to FIL causing an infinite loop, instead standardize later
        const redirectPath =
          localizedPathWithParameters ||
          (pathnameLocale
            ? pathname.replace(
                new RegExp(`^/${pathnameLocale}`),
                `/${userLocale}`
              )
            : `/${userLocale}${pathname}`);
        const redirectUrl = new URL(redirectPath, originalUrl);
        redirectUrl.search = originalUrl.search;
        const response = NextResponse.redirect(redirectUrl);
        if (userLocale) {
          response.cookies.set(middlewareLocaleName, userLocale);
        }
        return response;
      }

      // REDIRECT CASE: mismatched localized path (/fr/about -> /fr/le-about), mismatched dynamic path (/fr/dashboard/1/custom -> /fr/dashboard/1/le-custom)
      if (localizedPathWithParameters) {
        const redirectUrl = new URL(localizedPathWithParameters, originalUrl);
        redirectUrl.search = originalUrl.search;
        const response = NextResponse.redirect(redirectUrl);
        if (userLocale) {
          response.cookies.set(middlewareLocaleName, userLocale);
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
