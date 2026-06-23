import {
  I18nStore,
  InternalGTProvider,
} from '@generaltranslation/react-core/context';
import { useMemo, useRef } from 'react';
import type { SharedGTProviderProps } from './GTProviderProps';
import { BrowserConditionStore } from '../condition-store/BrowserConditionStore';
import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
} from '../internal';

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
    return new BrowserConditionStore({
      ...props,
      locale,
      enableI18n,
      localeCookieName: defaultLocaleCookieName,
      enableI18nCookieName: defaultEnableI18nCookieName,
    });
  }, [props, locale, enableI18n]);

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
