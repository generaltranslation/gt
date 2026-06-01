import { InternalGTProvider } from '@generaltranslation/react-core/context';
import type { SharedGTProviderProps } from './SharedGTProviderProps';
import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
} from '../cookie-names';
import { BrowserConditionStore } from '../condition-store/BrowserConditionStore';
import { useMemo } from 'react';
import {
  determineEnableI18n,
  determineLocale,
} from '../condition-store/createBrowserConditionStore';

/**
 * Client side GTProvider, this is different from server side
 * GTProvider because needs to syncrhonize any incoming
 * server-side translations
 */
export function BrowserGTProvider(props: SharedGTProviderProps) {
  const conditionStore = useMemo(() => {
    const locale = determineLocale(props);
    const enableI18n = determineEnableI18n(props);
    return new BrowserConditionStore({
      ...props,
      localeCookieName: defaultLocaleCookieName,
      enableI18nCookieName: defaultEnableI18nCookieName,
      locale,
      enableI18n,
    });
  }, [props]);

  return <InternalGTProvider {...props} conditionStore={conditionStore} />;
}
