'use client';
import { ClientProvider as _ClientProvider } from 'gt-react/client';
import { ClientProviderProps } from 'gt-react/internal';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { extractLocale } from '../middleware-dir/utils';
import { GT } from 'generaltranslation';

export default function ClientProvider(
  props: ClientProviderProps & {
    localeRoutingEnabledCookieName: string;
    referrerLocaleCookieName: string;
  }
) {
  const {
    locale,
    locales,
    defaultLocale,
    gtServicesEnabled,
    referrerLocaleCookieName,
    localeRoutingEnabledCookieName,
  } = props;

  // Trigger page reload when locale changes
  // When nav to same route but in diff locale, client components were cached and not re-rendered
  const pathname = usePathname();
  useEffect(() => {
    // ----- Referrer Locale ----- //
    if (locale) {
      document.cookie = `${referrerLocaleCookieName}=${locale};path=/`;
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
      const extractedLocale = extractLocale(pathname) || defaultLocale;
      const pathLocale = GT.determineLocale(
        [
          gtServicesEnabled
            ? GT.standardizeLocale(extractedLocale)
            : extractedLocale,
          defaultLocale,
        ],
        locales
      );

      if (pathLocale && locales.includes(pathLocale) && pathLocale !== locale) {
        // clear cookie (avoids infinite loop when there is no middleware)
        document.cookie = `${localeRoutingEnabledCookieName}=;path=/`;

        // reload page
        window.location.reload();
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
  ]);

  return <_ClientProvider {...props} />;
}
