'use client';
import { ClientProvider as _ClientProvider } from 'gt-react/client';
import { ClientProviderProps } from 'gt-react/internal';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ClientProvider(
  props: Omit<ClientProviderProps, 'onLocaleChange'>
) {
  // locale change on client, trigger page reload
  const router = useRouter();
  const onLocaleChange = () => {
    document.cookie = `generaltranslation.locale.reset=true;path=/`;
    router.refresh();
  };

  // Trigger page reload when locale changes
  // When nav to same route but in diff locale, client components were cached and not re-rendered
  const pathname = usePathname();
  useEffect(() => {
    console.log(`${pathname} re-rendered`);
    const newLocale = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`generaltranslation.middleware.locale=`))
      ?.split('=')[1];
    if (newLocale && newLocale !== props.locale) {
      console.log('New cookie locale', newLocale);

      // reload server
      router.refresh();

      // reload client
      window.location.reload();
    }
  }, [pathname]); // Re-run when pathname changes

  return <_ClientProvider onLocaleChange={onLocaleChange} {...props} />;
}
