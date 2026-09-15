import {
  I18nStore,
  InternalGTProvider,
} from '@generaltranslation/react-core/components';
import { useMemo, useRef } from 'react';
import type { SharedGTProviderProps } from './GTProviderProps';
import { createOrUpdateBrowserConditionStore } from '../condition-store/createBrowserConditionStore';

/**
 * Consumes snapshot from server
 * Implementation for client-side only
 */
export function BrowserGTProvider(props: SharedGTProviderProps) {
  const conditionStore = useMemo(() => {
    return createOrUpdateBrowserConditionStore(props);
  }, [
    props.locale,
    props.region,
    props.enableI18n,
    props._reload,
    // A rejected App Router locale switch can return the same locale as before.
    // Reconcile that new server result, but leave client-only rerenders alone.
    props._serverConditions,
  ]);

  const i18nStoreRef = useRef<I18nStore | null>(null);
  if (i18nStoreRef.current == null) {
    i18nStoreRef.current = new I18nStore();
  }

  return (
    <InternalGTProvider
      {...props}
      conditionStore={conditionStore}
      i18nStore={i18nStoreRef.current}
    />
  );
}
