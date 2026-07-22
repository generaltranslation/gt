import { getI18nConfig } from '@generaltranslation/react-core/pure';

/** Resolve a supported locale from the first pathname segment. */
export function getLocaleFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/([^/]+)(?:\/|$)/);
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
export function getPathnameForLocale(pathname: string, locale: string): string {
  const i18nConfig = getI18nConfig();
  const pathLocale = getLocaleFromPath(pathname);
  const unlocalizedPath = pathLocale
    ? pathname.replace(/^\/[^/]+/, '') || '/'
    : pathname;
  const resolvedLocale = i18nConfig.resolveSupportedLocale(locale);

  if (resolvedLocale === i18nConfig.getDefaultLocale()) {
    return unlocalizedPath;
  }

  return `/${encodeURIComponent(resolvedLocale)}${
    unlocalizedPath === '/' ? '' : unlocalizedPath
  }`;
}
