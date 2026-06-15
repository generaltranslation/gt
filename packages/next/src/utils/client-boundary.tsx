'use client';

/**
 * This is a small boundary for RSC consumption of client components
 * Cannot be consumed through gt-react/index.rsc as deciding btwn
 * gt-react/index.server and gt-react/index.client can only happen
 * here. This matters for GTProvider, but not for LocaleSelector.
 * This pattern is just good to follow for carrying over different
 * behaviors between client and server from gt-react.
 */

export { LocaleSelector as Client_LocaleSelector } from 'gt-react/context';

import { getI18nConfig, I18nConfig, LocaleCandidates } from 'gt-i18n/internal';
import { GTProvider, type SharedGTProviderProps } from 'gt-react/context';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import {
  defaultLocaleRoutingEnabledCookieName,
  defaultReferrerLocaleCookieName,
} from './cookies';

/**
 * Small wrapper to embed nextjs app router behavior
 */
export function Client_GTProvider(props: SharedGTProviderProps) {
  const router = useRouter();
  const reload = useCallback(() => {
    // Reload server components
    router.refresh();
  }, [router]);
  // TODO: when routing is enabled, validate the path matches the locale
  usePathCheck({ reloadServer: reload, locale: props.locale });
  return <GTProvider {...props} _reload={reload} />;
}

/**
 * Reloads the server components if
 * TODO: optimize this hook
 */
function usePathCheck({
  reloadServer,
  locale,
  referrerLocaleCookieName = defaultReferrerLocaleCookieName,
  localeRoutingEnabledCookieName = defaultLocaleRoutingEnabledCookieName,
}: {
  reloadServer: () => void;
  locale: LocaleCandidates;
  referrerLocaleCookieName?: string;
  localeRoutingEnabledCookieName?: string;
}) {
  const pathname = usePathname();

  useEffect(() => {
    // Track the referrer locale for middleware
    const i18nConfig = getI18nConfig();
    if (locale) {
      document.cookie = `${referrerLocaleCookieName}=${i18nConfig.resolveAliasLocale(typeof locale === 'string' ? locale : locale[0])};path=/`;
    }

    // Reload the server components if the pathname changes
    const locales = i18nConfig.getLocales();
    const defaultLocale = i18nConfig.getDefaultLocale();
    const middlewareEnabled =
      document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${localeRoutingEnabledCookieName}=`))
        ?.split('=')[1] === 'true';
    if (middlewareEnabled) {
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

        // reload page
        reloadServer();
      }
    }
  }, [
    pathname,
    locale,
    referrerLocaleCookieName,
    localeRoutingEnabledCookieName,
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
