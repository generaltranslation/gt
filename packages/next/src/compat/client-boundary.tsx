'use client';

import { GTProvider, type GTProviderProps } from 'gt-react/compat';
import { useAppRouterReload } from '../utils/client-boundary';

/**
 * Client boundary for the RSC `/compat` GTProvider. Only here can the bundler
 * pick gt-react's client or server-rendering GTProvider.
 */
export function Client_GTProvider({
  supportsLocaleRefresh,
  ...props
}: GTProviderProps & { supportsLocaleRefresh: boolean }) {
  const reload = useAppRouterReload(supportsLocaleRefresh, props.locale);
  return <GTProvider {...props} _reload={reload} />;
}
