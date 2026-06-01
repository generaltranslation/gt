import { ReadonlyConditionStore } from 'gt-i18n/internal';
import type { SharedGTProviderProps } from './SharedGTProviderProps';
import { InternalGTProvider } from '@generaltranslation/react-core/context';
import { useMemo } from 'react';

/**
 * For the server side GTProvider, we don't need to synchronize translations
 * as this will happen during the loader
 *
 * TODO: find some way to enforce this is only imported on the server
 */
export function ServerGTProvider(props: SharedGTProviderProps) {
  // The condition store may already be created at the module level
  const conditionStore = useMemo(() => {
    return new ReadonlyConditionStore(props);
  }, [props]);
  return <InternalGTProvider {...props} conditionStore={conditionStore} />;
}
