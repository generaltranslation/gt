import { getI18nConfig } from '@generaltranslation/react-core/pure';

/** Resolve a supported locale from the first pathname segment. */
export function getLocaleFromPath(
  pathname: string,
  basepath = getRouterBasepath()
): string | undefined {
  return splitLocaleSegment(splitBasepath(pathname, basepath).pathname).locale;
}

/** Replace the pathname locale, leaving the default locale unprefixed. */
export function getPathnameForLocale(
  pathname: string,
  locale: string,
  basepath = getRouterBasepath()
): string {
  const { basepath: routeBasepath, pathname: routePathname } = splitBasepath(
    pathname,
    basepath
  );
  return `${routeBasepath}${prefixLocaleSegment(
    splitLocaleSegment(routePathname).pathname,
    locale
  )}`;
}

/**
 * Remove a supported locale from the first segment of a basepath-free
 * pathname. The rest of the pathname keeps its original encoding.
 */
export function splitLocaleSegment(pathname: string): {
  locale?: string;
  pathname: string;
} {
  const match = pathname.match(/^\/([^/]+)(?=\/|$)/);
  if (!match) return { pathname };

  let segment: string;
  try {
    segment = decodeURIComponent(match[1]);
  } catch {
    return { pathname };
  }

  const locale = getI18nConfig().determineSupportedLocale(segment);
  if (!locale) return { pathname };
  return { locale, pathname: pathname.slice(match[0].length) || '/' };
}

/**
 * Prefix a basepath-free, locale-free pathname with a non-default locale.
 * The pathname is not checked for an existing locale segment, so a route that
 * starts with a locale-shaped segment keeps it.
 */
export function prefixLocaleSegment(pathname: string, locale: string): string {
  const i18nConfig = getI18nConfig();
  const resolvedLocale = i18nConfig.resolveSupportedLocale(locale);

  if (resolvedLocale === i18nConfig.getDefaultLocale()) return pathname;

  return `/${encodeURIComponent(resolvedLocale)}${
    pathname === '/' ? '' : pathname
  }`;
}

function getRouterBasepath(): string {
  return process.env.TSS_ROUTER_BASEPATH || '/';
}

function splitBasepath(
  pathname: string,
  basepath: string
): { basepath: string; pathname: string } {
  const normalizedBasepath = `/${basepath.replace(/^\/+|\/+$/g, '')}`;
  if (normalizedBasepath === '/' || pathname === normalizedBasepath) {
    return {
      basepath: normalizedBasepath === '/' ? '' : normalizedBasepath,
      pathname: pathname === normalizedBasepath ? '/' : pathname,
    };
  }
  if (pathname.startsWith(`${normalizedBasepath}/`)) {
    return {
      basepath: normalizedBasepath,
      pathname: pathname.slice(normalizedBasepath.length),
    };
  }
  return { basepath: '', pathname };
}
