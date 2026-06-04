import {
  InternalGTProvider,
  ReadonlyConditionStore,
} from '@generaltranslation/react-core/context';
import { useMemo } from 'react';
import type { SharedGTProviderProps } from './GTProviderProps';

/**
 * Consumes snapshot from server
 * Implementation for client-side only
 */
export function BrowserGTProvider({
  locale,
  enableI18n,
  ...props
}: SharedGTProviderProps) {
  const conditionStore = useMemo(() => {
    return new ReadonlyConditionStore({ locale, enableI18n });
  }, [locale, enableI18n]);

  return <InternalGTProvider {...props} conditionStore={conditionStore} />;
}
