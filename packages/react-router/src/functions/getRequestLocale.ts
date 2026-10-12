import {
  getI18nConfig,
  getLocaleFromPath,
  getPathnameForLocale,
} from 'gt-i18n/internal';
import { parseLocale } from 'gt-react';
import { redirect } from 'react-router';
import { isLocaleRoutingEnabled } from '../setup/initializeGT';

/**
 * Resolve the visitor's locale for a request, from a loader.
 *
 * With locale routing, the URL's locale wins over the locale cookie and the
 * Accept-Language header, and a URL that does not match the locale throws a
 * redirect: `/about` for a French visitor goes to `/fr/about`, and
 * `/fr-CA/about` goes to `/fr/about` when `fr` is the supported locale.
 */
export function getRequestLocale(
  request: Pick<Request, 'headers' | 'url'>
): string {
  if (!isLocaleRoutingEnabled()) return parseLocale(request);
  const url = new URL(request.url);
  const pathLocale = getLocaleFromPath(url.pathname);
  // An explicit default-locale prefix (/en/about) is kept: redirecting to
  // /about would let a stale locale cookie redirect away from it again.
  if (pathLocale === getI18nConfig().getDefaultLocale()) return pathLocale;
  const locale = pathLocale ?? parseLocale(request);
  const pathname = getPathnameForLocale(url.pathname, locale);
  if (pathname !== url.pathname) throw redirect(`${pathname}${url.search}`);
  return locale;
}
