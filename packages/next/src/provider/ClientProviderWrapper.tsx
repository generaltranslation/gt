'use client';
import { ClientProvider as _ClientProvider } from 'gt-react/client';
import { ClientProviderProps } from 'gt-react/internal';
import { useRouter } from 'next/navigation';

export default function ClientProvider(
  props: Omit<ClientProviderProps, 'onLocaleChange'>
) {
  // locale change on client, trigger page reload
  const router = useRouter();
  const onLocaleChange = () => {
    document.cookie = `generaltranslation.locale.reset=true;path=/`;
    router.refresh();
  };
  return <_ClientProvider onLocaleChange={onLocaleChange} {...props} />;
}
