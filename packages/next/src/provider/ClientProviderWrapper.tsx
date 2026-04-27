'use client';
import { ClientProvider } from 'gt-react/client';
import { ClientProviderProps } from 'gt-react/internal';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import {
  determineLocale,
  resolveAliasLocale,
  standardizeLocale,
} from 'generaltranslation';
import { CustomMapping } from 'generaltranslation/types';
import { useRouter } from 'next/navigation';

function extractLocale(
  pathname: string,
  customMapping?: CustomMapping
): string | null {
  const matches = pathname.match(/^\/([^\/]+)(?:\/|$)/);
  return matches ? resolveAliasLocale(matches[1], customMapping) : null;
}

export default function ClientProviderWrapper(
  props: Omit<ClientProviderProps, 'reloadServer'> & {
    localeRoutingEnabledCookieName: string;
    referrerLocaleCookieName: string;
  }
) {
  const router = useRouter();
  const {
    locale,
    locales,
    defaultLocale,
    gtServicesEnabled,
    referrerLocaleCookieName,
    localeRoutingEnabledCookieName,
    customMapping,
  } = props;

  /**
   * Reloads server components
   * Must pass as a callback so the refresh function does not lose access to the router instance
   */
  const reloadServer = useCallback(() => {
    router.refresh();
  }, [router]);

  // Trigger page reload when locale changes
  // When nav to same route but in diff locale, client components were cached and not re-rendered
  const pathname = usePathname();
  useEffect(() => {
    // ----- Referrer Locale ----- //
    if (locale) {
      document.cookie = `${referrerLocaleCookieName}=${resolveAliasLocale(locale, customMapping)};path=/`;
    }

    // ----- Middleware ----- //
    // Trigger page reload when locale changes
    // When nav to same route but in diff locale (ie, /en/blog -> /fr/blog), client components were cached and not re-rendered
    const middlewareEnabled =
      document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${localeRoutingEnabledCookieName}=`))
        ?.split('=')[1] === 'true';
    if (middlewareEnabled) {
      // Extract locale from pathname
      const extractedLocale =
        extractLocale(pathname, customMapping) || defaultLocale;
      let pathLocale = determineLocale(
        [
          gtServicesEnabled
            ? standardizeLocale(extractedLocale)
            : extractedLocale,
          defaultLocale,
        ],
        locales,
        customMapping
      );
      if (pathLocale) {
        pathLocale = resolveAliasLocale(pathLocale, customMapping);
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
    locales,
    defaultLocale,
    gtServicesEnabled,
    referrerLocaleCookieName,
    localeRoutingEnabledCookieName,
    reloadServer,
    customMapping,
  ]);

  return <ClientProvider {...props} reloadServer={reloadServer} />;
}
