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
import { getCookieValue, setCookieValue } from '../condition-store/cookies';
import { reloadPage } from '../utils/reloadPage';

type Conditions = Parameters<NonNullable<SharedGTProviderProps['_reload']>>[0];

/**
 * Whether the browser restored this document from its history (Back or
 * Forward). Browsers can reuse a cached page for these navigations, rendered
 * before the visitor's latest locale choice.
 */
function isHistoryNavigation(): boolean {
  if (typeof performance === 'undefined') return false;
  const [entry] = performance.getEntriesByType?.('navigation') ?? [];
  return (
    (entry as PerformanceNavigationTiming | undefined)?.type === 'back_forward'
  );
}

/** Client-side provider for server-rendered applications. */
export function BrowserGTProvider(props: SharedGTProviderProps) {
  const i18nConfig = getI18nConfig();
  const { locale, region } = props;
  const enableI18n = props.enableI18n ?? true;
  const reload = useCallback(
    (next: Conditions) => {
      if (props._reload) props._reload(next);
      else reloadPage();
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

  // 'stale' when a page restored from history shows an older locale than the
  // cookie, which then holds the visitor's newer choice. The page reloads its
  // own URL, so the server decides between the cookie and a locale in the URL,
  // and this document never writes its older locale over the cookie.
  const restoredLocale = useRef<'unchecked' | 'stale' | 'current'>('unchecked');

  useEffect(() => {
    const localeCookieName = i18nConfig.getLocaleCookieName();
    if (restoredLocale.current === 'unchecked') {
      const cookieValue = isHistoryNavigation()
        ? getCookieValue({ cookieName: localeCookieName })
        : undefined;
      const cookieLocale =
        cookieValue && i18nConfig.resolveSupportedLocale(cookieValue);
      if (cookieLocale && cookieLocale !== locale) {
        restoredLocale.current = 'stale';
        reloadPage();
      } else {
        restoredLocale.current = 'current';
      }
    }
    if (restoredLocale.current === 'stale') return;

    setCookieValue({
      cookieName: localeCookieName,
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
