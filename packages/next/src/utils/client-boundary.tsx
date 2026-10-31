'use client';

/**
 * This is a small boundary for RSC consumption of client components
 * Cannot be consumed through gt-react/index.rsc as deciding btwn
 * gt-react/index.server and gt-react/index.client can only happen
 * here. This matters for GTProvider, but not for LocaleSelector.
 * This pattern is just good to follow for carrying over different
 * behaviors between client and server from gt-react.
 */

export { LocaleSelector as Client_LocaleSelector } from 'gt-react';
export { RegionSelector as Client_RegionSelector } from 'gt-react';

import { getCookieValue, getI18nConfig, I18nConfig } from 'gt-i18n/internal';
import { GTProvider, type SharedGTProviderProps } from 'gt-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { initializeGTClient } from '../setup/initGT.client';
import {
  defaultLocaleRoutingEnabledCookieName,
  defaultReferrerLocaleCookieName,
} from './cookies';
import { localizeHref } from '../link/localize-utils';
import { compilePathRegex, pathnameMatchesRegex } from './pathRegex';

type ClientPathConfig = Record<string, string | Record<string, string>>;

/**
 * Reads the `pathConfig` shared with the client at build time, if localized
 * path aliases are configured. Absent in apps that don't use aliases.
 */
function getClientPathConfig(): ClientPathConfig | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const params = JSON.parse(
      process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS || '{}'
    );
    return typeof params.pathConfig === 'object' && params.pathConfig !== null
      ? params.pathConfig
      : undefined;
  } catch {
    return undefined;
  }
}

/** Normalizes a Next `basePath` to `''` or a slash-prefixed, slash-suffix-free form. */
function normalizeBasePath(basePath: string | undefined): string {
  if (!basePath || basePath === '/') return '';
  return basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
}

/**
 * Strips the Next `basePath` from a browser pathname. App routing, locale
 * prefixes, and `pathConfig` entries are all relative to the base path, so it
 * must be removed before resolving either one.
 */
function stripBasePath(pathname: string, basePath: string): string {
  if (!basePath) return pathname;
  if (pathname === basePath) return '/';
  return pathname.startsWith(`${basePath}/`)
    ? pathname.slice(basePath.length)
    : pathname;
}

/**
 * Resolves the current, possibly alias-localized app path back to its shared
 * route: with `pathConfig` mapping `/about` to `{ fr: '/a-propos' }`, the
 * French alias `/a-propos` resolves to `/about`. Paths that are not a
 * declared alias are returned unchanged, matching how the middleware treats
 * unknown paths as shared routes.
 */
function resolveSharedPath(
  appPath: string,
  pathConfig: ClientPathConfig | undefined
): string {
  if (!pathConfig) return appPath;
  for (const [sharedPath, localizedPaths] of Object.entries(pathConfig)) {
    if (
      typeof localizedPaths === 'object' &&
      localizedPaths !== null &&
      Object.values(localizedPaths).includes(appPath)
    ) {
      return sharedPath;
    }
  }
  return appPath;
}

/**
 * Resolves the public path for a shared route in the target locale: its
 * declared alias for that locale when one exists (e.g. German `/about` →
 * `/uber-uns`), otherwise the shared route with the locale prefix applied by
 * `localizeHref`.
 */
function localizeSharedPath(
  sharedPath: string,
  locale: string,
  pathConfig: ClientPathConfig | undefined,
  currentLocale: string,
  defaultLocale: string
): string {
  const localizedPaths = pathConfig?.[sharedPath];
  if (typeof localizedPaths === 'object' && localizedPaths !== null) {
    const alias = localizedPaths[locale];
    if (typeof alias === 'string') {
      return `/${locale}${alias}`;
    }
  }
  return localizeHref(sharedPath, locale, currentLocale, defaultLocale);
}

// withGTConfig exposes this build-time value to both middleware and client code.
const pathRegex = compilePathRegex(process.env._GENERALTRANSLATION_PATH_REGEX);

/**
 * Only need to initalize client. We know server was already
 * inialaized by index.rsc.ts. We do not know yet if client
 * has been initialized by index.client.ts.
 */
if (typeof window !== 'undefined') {
  initializeGTClient();
}

/**
 * Small wrapper to embed nextjs app router behavior
 */
export function Client_GTProvider({
  supportsLocaleRefresh,
  ...props
}: SharedGTProviderProps & {
  supportsLocaleRefresh: boolean;
}) {
  const router = useRouter();
  const refreshServerComponents = useCallback(() => {
    // Older Next versions can retain a stale layout/provider after a redirect.
    if (!supportsLocaleRefresh) {
      globalThis.location.reload();
      return;
    }
    router.refresh();
  }, [router, supportsLocaleRefresh]);
  const reloadBrowserPage = useCallback(() => {
    globalThis.location.reload();
  }, []);
  const syncServerContent = useCallback<
    NonNullable<SharedGTProviderProps['_reload']>
  >(
    ({ locale }) => {
      const i18nConfig = getI18nConfig();
      const localeRoutingEnabled =
        getCookieValue(
          document.cookie,
          defaultLocaleRoutingEnabledCookieName
        ) === 'true';
      const defaultLocale = i18nConfig.getDefaultLocale();
      const locales = i18nConfig.getLocales();
      const currentPathname = globalThis.location.pathname;
      const localeRoutingApplies =
        localeRoutingEnabled &&
        pathnameMatchesRegex(currentPathname, pathRegex);
      if (localeRoutingApplies && locale === defaultLocale) {
        const currentPathLocale = resolvePathLocale(
          currentPathname,
          i18nConfig,
          defaultLocale,
          locales
        );
        if (currentPathLocale !== defaultLocale) {
          reloadBrowserPage();
          return;
        }
      }
      if (localeRoutingApplies && locale !== defaultLocale) {
        // Switching to a non-default locale navigates straight to the target
        // locale's URL, computed with the same rules as the middleware, so no
        // extra redirect hop is needed.
        const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
        const appPathname = stripBasePath(currentPathname, basePath);
        const rawPathLocale = extractLocale(appPathname);
        const currentPathLocale = resolvePathLocale(
          appPathname,
          i18nConfig,
          defaultLocale,
          locales
        );
        // The middleware only ever prefixes configured locales, so a first
        // path segment that is not one (e.g. `/courses`) is not a locale prefix.
        const unprefixedPathname =
          rawPathLocale && locales.includes(rawPathLocale)
            ? stripLocaleFromPathname(appPathname, rawPathLocale)
            : appPathname;
        const pathConfig = getClientPathConfig();
        // Resolve the current alias back to its shared route before switching,
        // so the target locale gets its own alias instead of a re-prefixed one
        // the middleware cannot map.
        const sharedPath = resolveSharedPath(unprefixedPathname, pathConfig);
        const localizedPathname = localizeSharedPath(
          sharedPath,
          locale,
          pathConfig,
          currentPathLocale,
          defaultLocale
        );
        const search = globalThis.location.search;
        const hash = globalThis.location.hash;
        const targetHref = `${basePath}${localizedPathname}${search}${hash}`;
        if (targetHref !== `${currentPathname}${search}${hash}`) {
          // A full-page navigation keeps locale-dependent server-rendered
          // content (e.g. `<html lang>` or ancestors rendered by a shared root
          // layout) correct, works under a Next `basePath` deployment, and
          // still lands on the final URL in one hop.
          globalThis.location.assign(targetHref);
          return;
        }
      }

      refreshServerComponents();
    },
    [refreshServerComponents, reloadBrowserPage]
  );
  usePathCheck({
    reloadBrowserPage,
    refreshServerComponents,
    locale: props.locale,
  });
  return <GTProvider {...props} _reload={syncServerContent} />;
}

/**
 * Synchronizes server content if the URL locale does not match the selected
 * locale.
 * TODO: optimize this hook
 */
function usePathCheck({
  reloadBrowserPage,
  refreshServerComponents,
  locale,
  referrerLocaleCookieName = defaultReferrerLocaleCookieName,
  localeRoutingEnabledCookieName = defaultLocaleRoutingEnabledCookieName,
}: {
  reloadBrowserPage: () => void;
  refreshServerComponents: () => void;
  locale: string;
  referrerLocaleCookieName?: string;
  localeRoutingEnabledCookieName?: string;
}) {
  const pathname = usePathname();

  useEffect(() => {
    // Track the referrer locale for middleware
    const i18nConfig = getI18nConfig();
    document.cookie = `${referrerLocaleCookieName}=${locale};path=/`;

    // Synchronize server content if the pathname changes
    const locales = i18nConfig.getLocales();
    const defaultLocale = i18nConfig.getDefaultLocale();
    const localeRoutingEnabled =
      getCookieValue(document.cookie, localeRoutingEnabledCookieName) ===
      'true';
    if (localeRoutingEnabled && pathnameMatchesRegex(pathname, pathRegex)) {
      // Extract locale from pathname
      const currentPathLocale = resolvePathLocale(
        pathname,
        i18nConfig,
        defaultLocale,
        locales
      );

      // Both values are resolved to configured identities before comparison.
      if (
        currentPathLocale &&
        locales.includes(currentPathLocale) &&
        currentPathLocale !== locale
      ) {
        // clear cookie (avoids infinite loop when there is no middleware)
        document.cookie = `${localeRoutingEnabledCookieName}=;path=/`;

        if (locale === defaultLocale) {
          // A browser navigation follows the middleware redirect that removes
          // the default locale prefix. Next.js router.refresh() does not.
          reloadBrowserPage();
        } else {
          refreshServerComponents();
        }
      }
    }
  }, [
    pathname,
    locale,
    referrerLocaleCookieName,
    localeRoutingEnabledCookieName,
    reloadBrowserPage,
    refreshServerComponents,
  ]);
}

function resolvePathLocale(
  pathname: string,
  i18nConfig: I18nConfig,
  defaultLocale: string,
  locales: string[]
): string {
  const extractedLocale = extractLocale(pathname);
  if (!extractedLocale) {
    return defaultLocale;
  }

  return (
    i18nConfig.determineLocale([extractedLocale], locales) ?? defaultLocale
  );
}

function extractLocale(pathname: string): string | null {
  return pathname.match(/^\/([^/]+)(?:\/|$)/)?.[1] ?? null;
}

/** Removes a leading `/<locale>` segment from a localized pathname. */
function stripLocaleFromPathname(pathname: string, locale: string): string {
  if (pathname === `/${locale}`) return '/';
  if (pathname.startsWith(`/${locale}/`))
    return pathname.slice(locale.length + 1);
  return pathname;
}
