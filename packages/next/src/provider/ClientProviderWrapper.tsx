'use client';
import { ClientProvider as _ClientProvider } from 'gt-react/client';
import {
  ClientProviderProps,
  defaultLocaleCookieName,
} from 'gt-react/internal';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  middlewareLocaleResetFlagName,
  middlewareLocaleRoutingFlagName,
} from '../utils/constants';
import { extractLocale } from '../middleware-dir/utils';
import { standardizeLocale } from 'generaltranslation';

export default function ClientProvider(
  props: Omit<ClientProviderProps, 'onLocaleChange'>
) {
  // locale change on client, trigger page reload
  const router = useRouter();
  const onLocaleChange = () => {
    document.cookie = `${middlewareLocaleResetFlagName}=true;path=/`;
    router.refresh();
  };

  const pathname = usePathname();
  useEffect(() => {
    // ----- Referrer Locale ----- //
    if (props.locale) {
      // TODO: if this is the same as the brower's accepted locale, don't set the cookie (GDPR)
      document.cookie = `${defaultLocaleCookieName}=${props.locale};path=/`;
    }

    // ----- Middleware ----- //
    // Trigger page reload when locale changes
    // When nav to same route but in diff locale (ie, /en/blog -> /fr/blog), client components were cached and not re-rendered
    const middlewareEnabled =
      document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${middlewareLocaleRoutingFlagName}=`))
        ?.split('=')[1] === 'true';
    if (middlewareEnabled) {
      // Extract locale from pathname
      const extractedLocale = extractLocale(pathname) || props.defaultLocale;
      const pathLocale = props.gtServicesEnabled
        ? standardizeLocale(extractedLocale)
        : extractedLocale;
      if (
        pathLocale &&
        props.locales.includes(pathLocale) &&
        pathLocale !== props.locale
      ) {
        // clear cookie (avoids infinite loop when there is no middleware)
        document.cookie = `${middlewareLocaleRoutingFlagName}=;path=/`;
        // reload server
        router.refresh();
        // reload client
        window.location.reload();
      }
    }
  }, [
    pathname, // Re-run when pathname changes
    props.locale,
    props.locales,
    props.defaultLocale,
    props.gtServicesEnabled,
  ]);

  return <_ClientProvider onLocaleChange={onLocaleChange} {...props} />;
}
