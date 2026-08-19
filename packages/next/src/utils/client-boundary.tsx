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
  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);
  const reloadPage = useCallback(() => {
    globalThis.location.reload();
  }, []);
  const reload = useCallback<NonNullable<SharedGTProviderProps['_reload']>>(
    ({ locale }) => {
      const i18nConfig = getI18nConfig();
      const middlewareEnabled =
        getCookieValue(
          document.cookie,
          defaultLocaleRoutingEnabledCookieName
        ) === 'true';
      const defaultLocale = i18nConfig.getDefaultLocale();
      const pathLocale = extractLocale(
        globalThis.location.pathname,
        i18nConfig
      );

      if (
        middlewareEnabled &&
        locale === defaultLocale &&
        pathLocale &&
        pathLocale !== defaultLocale
      ) {
        reloadPage();
        return;
      }

      // Reload server components
      refresh();
    },
    [refresh, reloadPage]
  );
  // TODO: when routing is enabled, validate the path matches the locale
  usePathCheck({ reloadPage, reloadServer: refresh, locale: props.locale });
  return <GTProvider {...props} _reload={reload} />;
}

/**
 * Reloads content if the URL locale does not match the selected locale.
 * TODO: optimize this hook
 */
function usePathCheck({
  reloadPage,
  reloadServer,
  locale,
  referrerLocaleCookieName = defaultReferrerLocaleCookieName,
  localeRoutingEnabledCookieName = defaultLocaleRoutingEnabledCookieName,
}: {
  reloadPage: () => void;
  reloadServer: () => void;
  locale: string;
  referrerLocaleCookieName?: string;
  localeRoutingEnabledCookieName?: string;
}) {
  const pathname = usePathname();

  useEffect(() => {
    // Track the referrer locale for middleware
    const i18nConfig = getI18nConfig();
    document.cookie = `${referrerLocaleCookieName}=${i18nConfig.resolveAliasLocale(locale)};path=/`;

    // Reload the server components if the pathname changes
    const locales = i18nConfig.getLocales();
    const defaultLocale = i18nConfig.getDefaultLocale();
    const middlewareEnabled =
      getCookieValue(document.cookie, localeRoutingEnabledCookieName) ===
      'true';
    if (middlewareEnabled && pathnameMatchesRegex(pathname, pathRegex)) {
      // Extract locale from pathname
      const extractedLocale =
        extractLocale(pathname, i18nConfig) || defaultLocale;
      let pathLocale = i18nConfig.determineLocale(
        [
          i18nConfig.isGTServicesEnabled()
            ? i18nConfig.standardizeLocale(extractedLocale)
            : extractedLocale,
          defaultLocale,
        ],
        locales
      );
      if (pathLocale) {
        pathLocale = i18nConfig.resolveAliasLocale(pathLocale);
      }

      if (pathLocale && locales.includes(pathLocale) && pathLocale !== locale) {
        // clear cookie (avoids infinite loop when there is no middleware)
        document.cookie = `${localeRoutingEnabledCookieName}=;path=/`;

        if (locale === defaultLocale) {
          // A browser navigation follows the middleware redirect that removes
          // the default locale prefix. Next.js router.refresh() does not.
          reloadPage();
        } else {
          reloadServer();
        }
      }
    }
  }, [
    pathname,
    locale,
    referrerLocaleCookieName,
    localeRoutingEnabledCookieName,
    reloadPage,
    reloadServer,
  ]);
}

function extractLocale(
  pathname: string,
  i18nConfig: I18nConfig
): string | null {
  const matches = pathname.match(/^\/([^/]+)(?:\/|$)/);
  return matches ? i18nConfig.resolveAliasLocale(matches[1]) : null;
}
