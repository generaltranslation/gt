'use client';
import { ClientProvider as _ClientProvider } from 'gt-react/client';
import { ClientProviderProps } from 'gt-react/internal';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { extractLocale } from '../middleware-dir/utils';
import { GT, standardizeLocale } from 'generaltranslation';

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
    devApiKey,
    projectId,
    runtimeUrl,
    customMapping,
  } = props;

  const gt = useMemo(
    () =>
      new GT({
        devApiKey,
        sourceLocale: defaultLocale,
        targetLocale: locale,
        projectId,
        baseUrl: runtimeUrl || undefined,
        customMapping,
      }),
    [devApiKey, defaultLocale, locale, projectId, runtimeUrl, customMapping]
  );

  // Trigger page reload when locale changes
  // When nav to same route but in diff locale, client components were cached and not re-rendered
  const pathname = usePathname();
  useEffect(() => {
    // ----- Referrer Locale ----- //
    if (locale) {
      document.cookie = `${referrerLocaleCookieName}=${gt.resolveAliasLocale(locale)};path=/`;
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
      const extractedLocale = extractLocale(pathname, gt) || defaultLocale;
      let pathLocale = gt.determineLocale(
        [
          gtServicesEnabled
            ? standardizeLocale(extractedLocale)
            : extractedLocale,
          defaultLocale,
        ],
        locales
      );
      if (pathLocale) {
        pathLocale = gt.resolveAliasLocale(pathLocale);
      }

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
