import type { SharedGTProviderProps } from 'gt-react';
import { markNavigatingReload } from 'gt-i18n/internal';
import {
  getLocaleFromPath,
  getPathnameForLocale,
} from '../functions/localeRouting';
import { getRouterLocaleRewrite as getLocaleRewrite } from '../router/localeRewrite';
import type { GTIntegrableRouter, GTLocationRewrite } from '../router/types';

// The browser's locale routing. The plugin resolves
// gt-tanstack-start/internal/localeRouting to this file when gt.config.json
// enables localeRouting, and to localeRouting.disabled otherwise, so other
// apps don't ship this code.

/** The rewrite that keeps routes and links locale-free. */
export function getRouterLocaleRewrite(
  router: GTIntegrableRouter,
  getLocale: () => string
): GTLocationRewrite | undefined {
  return getLocaleRewrite(router, getLocale);
}

/** The locale in the current URL, which wins over the cookie. */
export function getPathLocale(): string | undefined {
  return getLocaleFromPath(window.location.pathname);
}

/**
 * Moves the visitor onto their locale's URL before Router reads it, as the
 * server redirects them. A static SPA host can't redirect.
 */
export function replaceWithLocaleURL(
  router: GTIntegrableRouter,
  locale: string
): void {
  const { pathname, search, hash } = window.location;
  const localePathname = getPathnameForLocale(pathname, locale);
  // A protocol-relative path would point the history entry at another origin.
  if (localePathname === pathname || localePathname.startsWith('//')) return;
  router.history.replace(
    `${localePathname}${search}${hash}`,
    router.history.location.state
  );
  // Router hands the location it parsed before hydrating to the first
  // matches' context(). A new rewrite object makes update() parse the
  // replaced URL and store it.
  const { rewrite } = router.options;
  if (rewrite) router.update({ rewrite: { ...rewrite } });
}

/**
 * Switches locale by navigating to its URL instead of reloading this one. A
 * document navigation, so locale twins keep it as the reload.
 */
export function createLocaleReload(): SharedGTProviderProps['_reload'] {
  return markNavigatingReload(({ locale }: { locale: string }) => {
    const destination = new URL(window.location.href);
    destination.pathname = getPathnameForLocale(
      window.location.pathname,
      locale
    );
    window.location.assign(destination.href);
  });
}
