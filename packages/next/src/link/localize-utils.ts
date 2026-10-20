import type NextLink from 'next/link';
import type { ComponentProps } from 'react';
import { resolveMiddlewareConfig } from '../middleware-dir/resolveMiddlewareConfig';

export type LinkHref = ComponentProps<typeof NextLink>['href'];

/** A locale to prefix, `undefined` for the current locale, or `false` for none. */
export type LinkLocale = string | false | undefined;

let routingConfig: ReturnType<typeof resolveMiddlewareConfig> | undefined;

/**
 * Reads the routing options passed to withGTConfig() on first use, so
 * importing gt-next/link does no work.
 */
function getRoutingConfig() {
  routingConfig ??= resolveMiddlewareConfig();
  return routingConfig;
}

/**
 * Returns the locale to prefix, or `false` when the middleware would not
 * redirect the unprefixed path. Unprefixed default-locale paths are rewritten
 * internally unless `prefixDefaultLocale` is set. An explicit default-locale
 * switch keeps its prefix while smart routing would otherwise route to the
 * locale cookie.
 */
function getPrefixLocale(
  locale: LinkLocale,
  currentLocale: string,
  defaultLocale: string
): string | false {
  if (locale === false) return false;
  const targetLocale = locale ?? currentLocale;
  const { prefixDefaultLocale, enableSmartRouting } = getRoutingConfig();
  if (prefixDefaultLocale || targetLocale !== defaultLocale)
    return targetLocale;
  return locale !== undefined && enableSmartRouting ? targetLocale : false;
}

function localizePath(href: string, locale: string): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;

  const url = new URL(href, 'http://localhost');
  url.pathname =
    url.pathname === '/'
      ? `/${encodeURIComponent(locale)}`
      : `/${encodeURIComponent(locale)}${url.pathname}`;

  return `${url.pathname}${url.search}${url.hash}`;
}

function prefixHref<T extends LinkHref>(href: T, locale: string | false): T {
  if (!locale) return href;

  if (typeof href === 'string') {
    return localizePath(href, locale) as T;
  }

  if (typeof href.pathname !== 'string') return href;

  const localizedPathname = localizePath(href.pathname, locale);
  if (localizedPathname === href.pathname) return href;

  return {
    ...href,
    pathname: localizedPathname,
  };
}

/**
 * Localizes an href the way `gt-next/link` does: internal paths are prefixed
 * only when the middleware would otherwise redirect them.
 */
export function localizeHref<T extends LinkHref>(
  href: T,
  locale: LinkLocale,
  currentLocale: string,
  defaultLocale: string
): T {
  return prefixHref(
    href,
    getPrefixLocale(locale, currentLocale, defaultLocale)
  );
}
