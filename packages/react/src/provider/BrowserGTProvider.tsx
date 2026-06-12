import {
  I18nStore,
  InternalGTProvider,
  ReadonlyConditionStore,
} from '@generaltranslation/react-core/context';
import { useMemo, useRef } from 'react';
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
  console.log(
    '<BrowserGTProvider> tx from server',
    JSON.stringify(props.translations)
  );
  const conditionStore = useMemo(() => {
    return new ReadonlyConditionStore({ locale, enableI18n });
  }, [locale, enableI18n]);

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
