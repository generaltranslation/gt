import { getLocaleFromPath, getPathnameForLocale } from 'gt-i18n/internal';
import { parseLocale } from 'gt-react';
import { redirect, type Params } from 'react-router';
import { isLocaleRoutingEnabled } from '../setup/initializeGT';

/**
 * Resolve the visitor's locale from the root loader's arguments.
 *
 * With locale routing, the route's `locale` param wins over the locale cookie
 * and the Accept-Language header, and a URL that does not match the locale
 * throws a redirect: `/about` for a French visitor goes to `/fr/about`, and
 * `/fr-CA/about` goes to `/fr/about` when `fr` is the supported locale.
 */
export function getRequestLocale({
  request,
  params,
  unstable_url,
  url = unstable_url ?? new URL(request.url),
}: {
  request: Pick<Request, 'headers' | 'url'>;
  params: Params;
  url?: URL;
  /** React Router 7.13.2 to 7.14's name for `url`. */
  unstable_url?: URL;
}): string {
  if (!isLocaleRoutingEnabled()) return parseLocale(request);
  const segment = params.locale;
  // Read the locale from the URL: in the param, a literal %2F is a /.
  const pathLocale =
    segment === undefined ? undefined : getLocaleFromPath(url.pathname);
  const locale = pathLocale ?? parseLocale(request);
  // A locale prefix stays, even the default locale's: redirecting /en/about
  // to /about would let a stale locale cookie redirect away from it again.
  // Any other segment is part of the path that React Router read as the
  // locale, as when /docs/about matches the about route.
  const pathname =
    segment === undefined
      ? getPathnameForLocale(url.pathname, locale)
      : `/${encodeURIComponent(locale)}${
          pathLocale ? url.pathname.replace(/^\/[^/]+/, '') : url.pathname
        }`;
  // A leading // would make the redirect leave the site.
  if (pathname !== url.pathname) {
    throw redirect(`${pathname.replace(/^\/+/, '/')}${url.search}`);
  }
  return locale;
}
