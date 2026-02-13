import React from 'react';
import { GTProvider as GTReactProvider } from 'gt-react';
import { GTProviderProps } from './types';
import { useDetermineLocale } from '../hooks/useDetermineLocale';
import { useRegionState } from '../hooks/useRegionState';
import { determineLocale } from '../functions/determineLocale';

export function GTProvider(props: GTProviderProps): React.ReactNode {
  const locale =
    props.locale || typeof window === 'undefined'
      ? determineLocale()
      : undefined;
  console.log('[GTProvider - tanstack-start]', 'locale:', locale);
  return (
    <GTReactProvider
      // ssr={typeof window !== 'undefined'}
      {...props}
      locale={locale}
      // TODO: might not need this, because on server side, only concerned about getting locale once
      // that being said, it would still be good practice to standardize how locale is being determined everywhere
      // useDetermineLocale={useDetermineLocale}
    />
  );
}
