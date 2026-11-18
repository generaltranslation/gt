import { getLocaleFromPath, getPathnameForLocale } from 'gt-react/paths';
import { parseLocale } from 'gt-react';
import { redirect, type Params } from 'react-router';
import { isLocaleRoutingEnabled } from '../setup/initializeGT';

/**
 * Resolve the visitor's locale from the root loader's arguments.
 *
 * With locale routing, a first path segment that names a supported locale
 * wins over the locale cookie and the Accept-Language header, and a URL that
 * does not match the locale throws a redirect: `/about` for a French visitor
 * goes to `/fr/about`, and `/fr-CA/about` goes to `/fr/about` when `fr` is the
 * supported locale.
 */
export function getRequestLocale({
  request,
  params,
  url = new URL(request.url),
}: {
  request: Pick<Request, 'headers' | 'url'>;
  params: Params;
  /** The page URL, which React Router 7.15 and later pass to loaders. */
  url?: URL;
}): string {
  if (!isLocaleRoutingEnabled()) return parseLocale(request);
  const pathLocale = getLocaleFromPath({ pathname: url.pathname });
  if (pathLocale) {
    // Keep the prefix, even the default locale's, so a stale cookie can't
    // redirect away from /en/about.
    const pathname = `/${encodeURIComponent(pathLocale)}${url.pathname.replace(/^\/[^/]+/, '')}`;
    if (pathname !== url.pathname) throw redirect(`${pathname}${url.search}`);
    return pathLocale;
  }
  const locale = parseLocale(request);
  // React Router read a first segment that isn't a locale as one, as when
  // /docs/about matches the about route.
  if (params.locale !== undefined) {
    throw redirect(
      `/${encodeURIComponent(locale)}${url.pathname}${url.search}`
    );
  }
  const pathname = getPathnameForLocale({ pathname: url.pathname, locale });
  if (pathname !== url.pathname) throw redirect(`${pathname}${url.search}`);
  return locale;
}
