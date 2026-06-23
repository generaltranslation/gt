import {
  I18nStore,
  InternalGTProvider,
} from '@generaltranslation/react-core/components';
import { useMemo, useRef } from 'react';
import type { SharedGTProviderProps } from './GTProviderProps';
import { BrowserConditionStore } from '../condition-store/BrowserConditionStore';

/**
 * Consumes snapshot from server
 * Implementation for client-side only
 */
export function BrowserGTProvider(props: SharedGTProviderProps) {
  const conditionStore = useMemo(() => {
    return new BrowserConditionStore(props);
  }, [props.locale, props.region, props.enableI18n, props._reload]);

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
