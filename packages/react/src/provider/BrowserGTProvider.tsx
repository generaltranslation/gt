import {
  InternalGTProvider,
  type InternalGTProviderProps,
} from '@generaltranslation/react-core/components';
import { I18nStore } from '@generaltranslation/react-core/pure';
import { useMemo, useRef } from 'react';
import type { SharedGTProviderProps } from './GTProviderProps';
import { ReadonlyBrowserConditionStore } from '../condition-store/ReadOnlyBrowserConditionStore';

/**
 * Consumes snapshot from server
 * Implementation for client-side only
 */
export function BrowserGTProvider(props: SharedGTProviderProps) {
  const conditionStore = useMemo(() => {
    return new ReadonlyBrowserConditionStore(props);
  }, [props.locale, props.region, props.enableI18n, props._reload]);

  const i18nStoreRef = useRef<InternalGTProviderProps['i18nStore'] | null>(
    null
  );
  if (i18nStoreRef.current == null) {
    i18nStoreRef.current =
      new I18nStore() as unknown as InternalGTProviderProps['i18nStore'];
  }

  return (
    <InternalGTProvider
      {...props}
      conditionStore={conditionStore}
      i18nStore={i18nStoreRef.current}
    />
  );
}
