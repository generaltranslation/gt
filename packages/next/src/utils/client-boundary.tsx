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
import { resolveMiddlewareConfig } from '../middleware-dir/resolveMiddlewareConfig';
import { compilePathRegex, pathnameMatchesRegex } from './pathRegex';

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
  const pathname = usePathname();
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
        // Go straight to the target URL, as <Link locale> would, instead of
        // refreshing the current URL and following the middleware's redirect.
        const href = getLocaleSwitchHref(pathname, locale, i18nConfig);
        if (href && supportsLocaleRefresh) {
          router.push(href);
          return;
        }
      }

      refreshServerComponents();
    },
    [
      pathname,
      refreshServerComponents,
      reloadBrowserPage,
      router,
      supportsLocaleRefresh,
    ]
  );
  usePathCheck({
    pathname,
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
  pathname,
  reloadBrowserPage,
  refreshServerComponents,
  locale,
  referrerLocaleCookieName = defaultReferrerLocaleCookieName,
  localeRoutingEnabledCookieName = defaultLocaleRoutingEnabledCookieName,
}: {
  pathname: string;
  reloadBrowserPage: () => void;
  refreshServerComponents: () => void;
  locale: string;
  referrerLocaleCookieName?: string;
  localeRoutingEnabledCookieName?: string;
}) {
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

/**
 * Returns the URL to switch the current page to a non-default locale, or
 * `undefined` when the switch should be left to the middleware: when the URL
 * would not change, or when localized aliases, route overrides, or per-locale
 * routes could make the middleware choose a different URL.
 */
function getLocaleSwitchHref(
  pathname: string,
  locale: string,
  i18nConfig: I18nConfig
): string | undefined {
  const { pathConfig, routeOverrides, localeRoutes } =
    resolveMiddlewareConfig();
  if (
    [pathConfig, routeOverrides, localeRoutes].some(
      (config) => Object.keys(config).length > 0
    )
  ) {
    return undefined;
  }
  const [, firstSegment = '', ...rest] = pathname.split('/');
  const sharedPath = i18nConfig.determineLocale(
    [firstSegment],
    i18nConfig.getLocales()
  )
    ? `/${rest.join('/')}`
    : pathname;
  const { search, hash } = globalThis.location;
  const href = localizeHref(
    `${sharedPath}${search}${hash}`,
    locale,
    locale,
    i18nConfig.getDefaultLocale()
  );
  return href === `${pathname}${search}${hash}` ? undefined : href;
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
