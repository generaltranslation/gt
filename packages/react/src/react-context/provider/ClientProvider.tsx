'use client';

import { GTProvider as CoreGTProvider } from '@generaltranslation/react-core';
import type { JSX } from 'react';
import type { ClientProviderProps } from '../types/config';
import { setCookieValue } from '../../shared/cookies';
import { readAuthFromEnv } from '../utils/readAuthFromEnv';
import { useDetermineLocale } from './hooks/locales/useDetermineLocale';
import { useRegionState } from './hooks/useRegionState';

// meant to be used inside the server-side <GTProvider>
export function ClientProvider({
  environment,
  resetLocaleCookieName,
  reloadServer,
  ...props
}: ClientProviderProps): JSX.Element {
  const display = !!(
    (!props.translationRequired || props.translations) &&
    props.locale
  );

  return (
    <CoreGTProvider
      {...props}
      ssr={true}
      environment={environment}
      cacheUrl={null}
      fallback={display ? props.children : undefined}
      readAuthFromEnv={readAuthFromEnv}
      useDetermineLocale={useDetermineLocale}
      useRegionState={useRegionState}
      onLocaleUpdate={() => {
        setCookieValue(resetLocaleCookieName, 'true');
        reloadServer();
      }}
    />
  );
}
