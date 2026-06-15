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

import { GTProvider, type SharedGTProviderProps } from 'gt-react/context';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

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
  return <GTProvider {...props} _reload={reload} />;
}
