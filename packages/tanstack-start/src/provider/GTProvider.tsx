import { GTProvider as _GTProvider } from '@generaltranslation/react-core';
import { readAuthFromEnv } from '../utils/utils';
import { useRegionState } from './hooks/useRegionState';
import { useDetermineLocale } from './hooks/locales/useDetermineLocale';
import { isSSREnabled } from './helpers/isSSREnabled';
import { GTProviderProps } from '../types/config';
import React from 'react';

export function GTProvider(props: GTProviderProps): React.JSX.Element {
  return (
    <_GTProvider
      ssr={isSSREnabled()}
      environment={
        process.env.NODE_ENV as 'development' | 'production' | 'test'
      }
      {...props}
      readAuthFromEnv={readAuthFromEnv}
      useDetermineLocale={useDetermineLocale}
      useRegionState={useRegionState}
    />
  );
}

export default GTProvider;
