import {
  I18nStore,
  I18nStoreCore,
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
  }, [props.locale, props.region, props.enableI18n, props._reload]);

  const i18nStoreRef = useRef<I18nStoreCore | null>(null);
  if (i18nStoreRef.current == null) {
    i18nStoreRef.current =
      process.env.NODE_ENV === 'production'
        ? new I18nStoreCore()
        : new I18nStore();
  }

  return (
    <InternalGTProvider
      {...props}
      conditionStore={conditionStore}
      i18nStore={i18nStoreRef.current}
    />
  );
}
