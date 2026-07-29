'use client';

import { GTProvider as ReactGTProvider } from 'gt-react';
import type { SharedGTProviderProps } from 'gt-react';
import Router from 'next/router';
import { nextLocaleCookieMaxAge, nextLocaleCookieName } from '../utils/cookies';

const navigateToLocale: NonNullable<SharedGTProviderProps['_reload']> = ({
  locale,
}) => {
  void Router.push(Router.pathname, Router.asPath, { locale });
};

/**
 * Pages Router provider that keeps GT state explicit while delegating locale
 * persistence and navigation to Next.js internationalized routing.
 */
export function GTProvider(props: SharedGTProviderProps) {
  return (
    <ReactGTProvider
      {...props}
      _localeCookieName={nextLocaleCookieName}
      _localeCookieOptions={getNextLocaleCookieOptions()}
      _reload={navigateToLocale}
      _resetLocaleCookie={false}
    />
  );
}

/** @internal Exported for deterministic cookie-policy tests. */
export function getNextLocaleCookieOptions(
  protocol = typeof window === 'undefined'
    ? undefined
    : window.location.protocol
) {
  return {
    maxAge: nextLocaleCookieMaxAge,
    path: '/',
    sameSite: 'lax' as const,
    secure: protocol === 'https:',
  };
}
