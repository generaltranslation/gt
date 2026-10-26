import type { SharedGTProviderProps } from 'gt-react';
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

/** Switches locale by navigating to its URL instead of reloading this one. */
export function createLocaleReload(): SharedGTProviderProps['_reload'] {
  return ({ locale }) => {
    const destination = new URL(window.location.href);
    destination.pathname = getPathnameForLocale(
      window.location.pathname,
      locale
    );
    window.location.assign(destination.href);
  };
}
