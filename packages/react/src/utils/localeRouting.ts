import { getI18nConfig } from 'gt-i18n/internal';

/** Resolve a supported locale from the first pathname segment. */
export function getLocaleFromPath({
  pathname,
  basepath = '/',
}: {
  pathname: string;
  basepath?: string;
}): string | undefined {
  const { pathname: routePathname } = splitBasepath(pathname, basepath);
  const match = routePathname.match(/^\/([^/]+)(?:\/|$)/);
  if (!match) return undefined;

  let segment: string;
  try {
    segment = decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }

  return getI18nConfig().determineSupportedLocale(segment);
}

/** Replace the pathname locale, leaving the default locale unprefixed. */
export function getPathnameForLocale({
  pathname,
  locale,
  basepath = '/',
}: {
  pathname: string;
  locale: string;
  basepath?: string;
}): string {
  const i18nConfig = getI18nConfig();
  const { basepath: routeBasepath, pathname: routePathname } = splitBasepath(
    pathname,
    basepath
  );
  const pathLocale = getLocaleFromPath({ pathname: routePathname });
  const unlocalizedPath = pathLocale
    ? routePathname.replace(/^\/[^/]+/, '') || '/'
    : routePathname;
  const resolvedLocale = i18nConfig.resolveSupportedLocale(locale);

  if (resolvedLocale === i18nConfig.getDefaultLocale()) {
    return `${routeBasepath}${unlocalizedPath}`;
  }

  return `${routeBasepath}/${encodeURIComponent(resolvedLocale)}${
    unlocalizedPath === '/' ? '' : unlocalizedPath
  }`;
}

function splitBasepath(
  pathname: string,
  basepath: string
): { basepath: string; pathname: string } {
  // Loops, not /^\/+|\/+$/: that regex is quadratic on runs of '/'.
  let start = 0;
  let end = basepath.length;
  while (basepath[start] === '/') start++;
  while (end > start && basepath[end - 1] === '/') end--;
  const base = `/${basepath.slice(start, end)}`;
  return base !== '/' && (pathname === base || pathname.startsWith(`${base}/`))
    ? { basepath: base, pathname: pathname.slice(base.length) || '/' }
    : { basepath: '', pathname };
}
