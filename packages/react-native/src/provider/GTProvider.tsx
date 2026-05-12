import { useDetermineLocale } from './hooks/locale/useDetermineLocale';
import type { GTProviderProps } from '../types/config';
import { GTProvider as _GTProvider } from '@generaltranslation/react-core';
import { readAuthFromEnv } from '../utils/utils';
import { useRegionState } from './hooks/useRegionState';

export function GTProvider(props: GTProviderProps): React.JSX.Element {
  return (
    <_GTProvider
      ssr={false}
      environment={__DEV__ ? 'development' : 'production'}
      {...props}
      readAuthFromEnv={readAuthFromEnv}
      useDetermineLocale={useDetermineLocale}
      useRegionState={useRegionState}
    />
  );
}

export default GTProvider;
