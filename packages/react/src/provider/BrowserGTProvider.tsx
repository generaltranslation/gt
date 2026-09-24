import {
  I18nStore,
  InternalGTProvider,
} from '@generaltranslation/react-core/components';
import {
  defaultResetLocaleCookieName,
  getI18nConfig,
} from '@generaltranslation/react-core/pure';
import { useCallback, useEffect, useRef } from 'react';
import type { SharedGTProviderProps } from './GTProviderProps';
import { setCookieValue } from '../condition-store/cookies';

type Conditions = Parameters<NonNullable<SharedGTProviderProps['_reload']>>[0];

/** Client-side provider for server-rendered applications. */
export function BrowserGTProvider(props: SharedGTProviderProps) {
  const i18nConfig = getI18nConfig();
  const { locale, region } = props;
  const enableI18n = props.enableI18n ?? true;
  const reload = useCallback(
    (next: Conditions) => {
      if (props._reload) props._reload(next);
      else if (typeof window !== 'undefined') window.location.reload();
    },
    [props._reload]
  );
  const setLocale = useCallback(
    (nextLocale: string) => {
      const resolvedLocale = i18nConfig.resolveSupportedLocale(nextLocale);
      setCookieValue({
        cookieName: i18nConfig.getLocaleCookieName(),
        value: resolvedLocale,
      });
      setCookieValue({
        cookieName: defaultResetLocaleCookieName,
        value: 'true',
      });
      reload({ locale: resolvedLocale, region, enableI18n });
    },
    [i18nConfig, region, enableI18n, reload]
  );
  const setRegion = useCallback(
    (nextRegion: string | undefined) => {
      setCookieValue({
        cookieName: i18nConfig.getRegionCookieName(),
        value: nextRegion ?? '',
      });
      reload({ locale, region: nextRegion, enableI18n });
    },
    [i18nConfig, locale, enableI18n, reload]
  );
  const setEnableI18n = useCallback(
    (nextEnableI18n: boolean) => {
      setCookieValue({
        cookieName: i18nConfig.getEnableI18nCookieName(),
        value: nextEnableI18n ? 'true' : 'false',
      });
      reload({ locale, region, enableI18n: nextEnableI18n });
    },
    [i18nConfig, locale, region, reload]
  );

  useEffect(() => {
    setCookieValue({
      cookieName: i18nConfig.getLocaleCookieName(),
      value: locale,
    });
    if (region !== undefined) {
      setCookieValue({
        cookieName: i18nConfig.getRegionCookieName(),
        value: region,
      });
    }
    setCookieValue({
      cookieName: i18nConfig.getEnableI18nCookieName(),
      value: enableI18n ? 'true' : 'false',
    });
  }, [i18nConfig, locale, region, enableI18n, props.translations]);

  const i18nStore = useI18nStore();

  return (
    <InternalGTProvider
      {...props}
      locale={locale}
      region={region}
      enableI18n={enableI18n}
      setLocale={setLocale}
      setRegion={setRegion}
      setEnableI18n={setEnableI18n}
      i18nStore={i18nStore}
    />
  );
}

function useI18nStore(): I18nStore {
  const i18nStoreRef = useRef<I18nStore | null>(null);
  if (i18nStoreRef.current == null) {
    i18nStoreRef.current = new I18nStore();
  }
  return i18nStoreRef.current;
}
