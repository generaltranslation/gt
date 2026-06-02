import {
  InternalGTProvider,
  ReadonlyConditionStore,
} from '@generaltranslation/react-core/context';
import { useMemo } from 'react';
import type { SharedGTProviderProps } from './GTProviderProps';

/**
 * Provides the server-rendered runtime snapshot to React consumers.
 */
export function GTProvider({
  locale,
  enableI18n,
  ...props
}: SharedGTProviderProps) {
  const conditionStore = useMemo(() => {
    return new ReadonlyConditionStore({ locale, enableI18n });
  }, [locale, enableI18n]);

  return <InternalGTProvider {...props} conditionStore={conditionStore} />;
}
