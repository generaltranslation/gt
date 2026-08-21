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
export function Client_GTProvider(props: SharedGTProviderProps) {
  const router = useRouter();
  const refreshServerComponents = useCallback(() => {
    router.refresh();
  }, [router]);
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
      const currentPathLocale = localeRoutingApplies
        ? resolvePathLocale(currentPathname, i18nConfig, defaultLocale, locales)
        : null;

      if (
        localeRoutingApplies &&
        locale === defaultLocale &&
        currentPathLocale &&
        currentPathLocale !== defaultLocale
      ) {
        reloadBrowserPage();
        return;
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
    document.cookie = `${referrerLocaleCookieName}=${i18nConfig.resolveAliasLocale(locale)};path=/`;

    // Synchronize server content if the pathname changes
    const locales = i18nConfig.getLocales();
    const defaultLocale = i18nConfig.getDefaultLocale();
    const localeRoutingEnabled =
      getCookieValue(document.cookie, localeRoutingEnabledCookieName) ===
      'true';
    if (localeRoutingEnabled && pathnameMatchesRegex(pathname, pathRegex)) {
      const currentPathLocale = resolvePathLocale(
        pathname,
        i18nConfig,
        defaultLocale,
        locales
      );

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
): string | null {
  const extractedLocale = extractLocale(pathname, i18nConfig) || defaultLocale;
  const currentPathLocale = i18nConfig.determineLocale(
    [
      i18nConfig.isGTServicesEnabled()
        ? i18nConfig.standardizeLocale(extractedLocale)
        : extractedLocale,
      defaultLocale,
    ],
    locales
  );
  return currentPathLocale
    ? i18nConfig.resolveAliasLocale(currentPathLocale)
    : null;
}

function extractLocale(
  pathname: string,
  i18nConfig: I18nConfig
): string | null {
  const matches = pathname.match(/^\/([^/]+)(?:\/|$)/);
  return matches ? i18nConfig.resolveAliasLocale(matches[1]) : null;
}
