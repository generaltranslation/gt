import { ServerGTProviderDev } from './ServerGTProvider.dev';
import { InternalGTProvider } from '@generaltranslation/react-core/components';
import { ReadonlyConditionStore } from '@generaltranslation/react-core/pure';
import { useMemo } from 'react';
import type { SharedGTProviderProps } from './GTProviderProps';
import { syncI18nCache } from './syncI18nCache';

function ServerGTProviderProd({
  locale,
  region,
  enableI18n,
  ...props
}: SharedGTProviderProps) {
  syncI18nCache(props);

  const conditionStore = useMemo(
    () => new ReadonlyConditionStore({ locale, region, enableI18n }),
    [locale, region, enableI18n]
  );

  return <InternalGTProvider {...props} conditionStore={conditionStore} />;
}

export const ServerGTProvider =
  process.env.NODE_ENV === 'production'
    ? ServerGTProviderProd
    : ServerGTProviderDev;
