'use client';
import { ClientProvider as _ClientProvider } from 'gt-react/client';
import { ClientProviderProps } from 'gt-react/internal';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  middlewareLocaleName,
  middlewareLocaleResetFlagName,
  middlewareLocaleRewriteFlagName,
} from '../utils/constants';

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
    console.log(`${pathname} re-rendered`);
    const newLocale = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${middlewareLocaleName}=`))
      ?.split('=')[1];
    if (newLocale && newLocale !== props.locale) {
      const rewriteFlag =
        document
          .querySelector(`meta[name="${middlewareLocaleRewriteFlagName}"]`)
          ?.getAttribute('content') === 'true';

      if (!rewriteFlag) {
        console.log('New cookie locale', newLocale, pathname);
        // reload server
        router.refresh();

        // reload client
        window.location.reload();
      } else {
        console.log('DO NOTHING: Rewrite flag is true', pathname);
      }
    }
  }, [pathname]); // Re-run when pathname changes

  return <_ClientProvider onLocaleChange={onLocaleChange} {...props} />;
}
