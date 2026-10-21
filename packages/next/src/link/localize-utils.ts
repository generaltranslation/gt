import type NextLink from 'next/link';
import type { ComponentProps } from 'react';
import { resolveMiddlewareConfig } from '../middleware-dir/resolveMiddlewareConfig';
import { compilePathRegex, pathnameMatchesRegex } from '../utils/pathRegex';

/** A locale to prefix, `undefined` for the current locale, or `false` for none. */
export type LinkLocale = ComponentProps<typeof NextLink>['locale'];

let routingConfig:
  | (ReturnType<typeof resolveMiddlewareConfig> & { pathRegex?: RegExp })
  | undefined;

/**
 * Reads the routing options passed to withGTConfig() on first use, so
 * importing gt-next/link does no work.
 */
function getRoutingConfig() {
  routingConfig ??= {
    ...resolveMiddlewareConfig(),
    pathRegex: compilePathRegex(process.env._GENERALTRANSLATION_PATH_REGEX),
  };
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

function prefixPath(path: string, locale: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;

  const url = new URL(path, 'http://localhost');
  if (!pathnameMatchesRegex(url.pathname, getRoutingConfig().pathRegex))
    return path;
  url.pathname =
    url.pathname === '/'
      ? `/${encodeURIComponent(locale)}`
      : `/${encodeURIComponent(locale)}${url.pathname}`;

  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Localizes an href the way `gt-next/link` does.
 *
 * Internal paths are prefixed with the target locale, except default-locale
 * paths when `prefixDefaultLocale` is `false` (an explicit default `locale`
 * keeps its prefix while `enableSmartRouting` is on). Localized path aliases
 * and locale availability are still resolved by the middleware. External URLs
 * and paths that don't match `pathRegex` are never prefixed.
 */
export function localizeHref(
  href: string,
  locale: LinkLocale,
  currentLocale: string,
  defaultLocale: string
): string {
  const prefixLocale = getPrefixLocale(locale, currentLocale, defaultLocale);
  return prefixLocale ? prefixPath(href, prefixLocale) : href;
}
