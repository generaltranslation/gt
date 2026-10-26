import type * as LocaleRouting from './localeRouting.enabled';

// The browser without locale routing: no rewrite, no pathname locale, and the
// default reload. Typed against the enabled module so the plugin can resolve
// to either one.

export const getRouterLocaleRewrite: typeof LocaleRouting.getRouterLocaleRewrite =
  () => undefined;

export const getPathLocale: typeof LocaleRouting.getPathLocale = () =>
  undefined;

export const createLocaleReload: typeof LocaleRouting.createLocaleReload = () =>
  undefined;
