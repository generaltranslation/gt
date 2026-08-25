import { InternalGTProvider } from '@generaltranslation/react-core/components';
import { ReadonlyConditionStore } from '@generaltranslation/react-core/pure';
import { useMemo } from 'react';
import type { SharedGTProviderProps } from './GTProviderProps';

/**
 * Consumes snapshot from server
 * Implementation for server-side only
 */
export function ServerGTProvider({
  locale,
  region,
  enableI18n,
  ...props
}: SharedGTProviderProps) {
  const conditionStore = useMemo(() => {
    return new ReadonlyConditionStore({ locale, region, enableI18n });
  }, [locale, region, enableI18n]);

  return (
    <InternalGTProvider
      {...props}
      conditionStore={conditionStore}
      resolveMissingDuringRender
    />
  );
}
