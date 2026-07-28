import { getI18nConfig } from '@generaltranslation/react-core/pure';

/** Resolve a supported locale from the first pathname segment. */
export function getLocaleFromPath(
  pathname: string,
  basepath = getRouterBasepath()
): string | undefined {
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
export function getPathnameForLocale(
  pathname: string,
  locale: string,
  basepath = getRouterBasepath()
): string {
  const i18nConfig = getI18nConfig();
  const { basepath: routeBasepath, pathname: routePathname } = splitBasepath(
    pathname,
    basepath
  );
  const pathLocale = getLocaleFromPath(routePathname, '/');
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
