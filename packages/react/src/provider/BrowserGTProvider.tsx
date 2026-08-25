import { InternalGTProvider } from '@generaltranslation/react-core/components';
import { useMemo } from 'react';
import type { SharedGTProviderProps } from './GTProviderProps';
import { createOrUpdateBrowserConditionStore } from '../condition-store/createBrowserConditionStore';

/**
 * Consumes snapshot from server
 * Implementation for client-side only
 */
export function BrowserGTProvider(props: SharedGTProviderProps) {
  const conditionStore = useMemo(() => {
    return createOrUpdateBrowserConditionStore(props);
  }, [props.locale, props.region, props.enableI18n, props._reload]);

  return <InternalGTProvider {...props} conditionStore={conditionStore} />;
}
