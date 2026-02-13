import React from 'react';
import { GTProvider as GTReactProvider } from 'gt-react';
import { GTProviderProps } from './types';
import { useDetermineLocale } from '../hooks/useDetermineLocale';
import { useRegionState } from '../hooks/useRegionState';
import { determineLocale } from '../functions/determineLocale';

export function GTProvider(props: GTProviderProps): React.ReactNode {
  console.log('[GTProvider - tanstack-start]');
  return (
    <GTReactProvider
      ssr={typeof process !== 'undefined'}
      {...props}
      locale={props.locale || determineLocale()}
      // TODO: might not need this, because on server side, only concerned about getting locale once
      // that being said, it would still be good practice to standardize how locale is being determined everywhere
      // useDetermineLocale={useDetermineLocale}
    />
  );
}
