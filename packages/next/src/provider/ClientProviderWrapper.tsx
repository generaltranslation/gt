'use client';
import { ClientProvider as _ClientProvider } from 'gt-react/client';
import { ClientProviderProps } from 'gt-react/internal';
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

  // Trigger page reload when locale changes
  // When nav to same route but in diff locale, client components were cached and not re-rendered
  const pathname = usePathname();
  useEffect(() => {
    // Get the cookie value
    const cookieValue = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${middlewareLocaleRoutingFlagName}=`))
      ?.split('=')[1];
    if (cookieValue === 'true') {
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
