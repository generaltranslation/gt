import type { GTProviderProps } from '@generaltranslation/react-core/types';
import { GTProvider as _GTProvider } from '@generaltranslation/react-core';
import { readAuthFromEnv } from '../utils/utils';
import { useRegionState } from './hooks/useRegionState';
import { useDetermineLocale } from './hooks/locales/useDetermineLocale';
import { isSSREnabled } from './helpers/isSSREnabled';
import React from 'react';

export function GTProvider(props: GTProviderProps): React.JSX.Element {
  return (
    <_GTProvider
      ssr={isSSREnabled()}
      {...props}
      readAuthFromEnv={readAuthFromEnv}
      useDetermineLocale={useDetermineLocale}
      useRegionState={useRegionState}
      environment={
        process.env.NODE_ENV as 'development' | 'production' | 'test'
      }
    />
  );
}

export default GTProvider;
