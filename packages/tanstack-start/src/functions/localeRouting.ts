import {
  getLocaleFromPath as getSharedLocaleFromPath,
  getPathnameForLocale as getSharedPathnameForLocale,
} from 'gt-react/paths';

/** Resolve a supported locale from the first segment after the basepath. */
export function getLocaleFromPath(pathname: string): string | undefined {
  return getSharedLocaleFromPath({
    pathname,
    basepath: process.env.TSS_ROUTER_BASEPATH,
  });
}

/** Replace the pathname locale, leaving the default locale unprefixed. */
export function getPathnameForLocale(pathname: string, locale: string): string {
  return getSharedPathnameForLocale({
    pathname,
    locale,
    basepath: process.env.TSS_ROUTER_BASEPATH,
  });
}
