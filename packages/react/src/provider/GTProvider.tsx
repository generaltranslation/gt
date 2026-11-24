import { getI18nConfig } from '@generaltranslation/react-core/pure';
import {
  ClientGTProvider,
  type ConditionStorage,
} from '@generaltranslation/react-core/components';
import {
  useLocale,
  useLocaleDirection,
} from '@generaltranslation/react-core/hooks';
import { useEffect } from 'react';
import { getCookieValue, setCookieValue } from '../condition-store/cookies';
import { readBrowserLocale } from '../condition-store/readBrowserLocale';
import { BrowserGTProvider } from './BrowserGTProvider';
import type { GTProviderProps } from './GTProviderProps';

/**
 * Provides GT to the components below it. Given `translations`, as a
 * server-rendered app gives it, it renders them at once. Without them it loads
 * each locale's translations itself and changes locale in place.
 */
export function GTProvider(props: GTProviderProps) {
  if (props.translations !== undefined) return <BrowserGTProvider {...props} />;
  const { children, translations: _translations, ...clientProps } = props;
  return (
    <ClientGTProvider
      {...clientProps}
      storage={cookieStorage}
      whenOutermost={<HtmlLocale />}
    >
      {children}
    </ClientGTProvider>
  );
}

/** What the visitor chose is kept in the cookies a server-rendered app reads. */
const cookieStorage: ConditionStorage = {
  read() {
    const i18nConfig = getI18nConfig();
    return {
      locale: readBrowserLocale(i18nConfig.getLocaleCookieName()),
      region:
        getCookieValue({ cookieName: i18nConfig.getRegionCookieName() }) ||
        undefined,
      // Read as BrowserConditionStore reads it: on unless the cookie says otherwise.
      enableI18n:
        (getCookieValue({
          cookieName: i18nConfig.getEnableI18nCookieName(),
        }) ?? 'true') === 'true',
    };
  },
  save(conditions) {
    const i18nConfig = getI18nConfig();
    if (conditions.locale !== undefined) {
      setCookieValue({
        cookieName: i18nConfig.getLocaleCookieName(),
        value: conditions.locale,
      });
    }
    if ('region' in conditions) {
      setCookieValue({
        cookieName: i18nConfig.getRegionCookieName(),
        value: conditions.region ?? '',
      });
    }
    if (conditions.enableI18n !== undefined) {
      setCookieValue({
        cookieName: i18nConfig.getEnableI18nCookieName(),
        value: conditions.enableI18n ? 'true' : 'false',
      });
    }
  },
};

/** Keeps `<html lang dir>` on the locale on screen: no server sets them here. */
function HtmlLocale() {
  const locale = useLocale();
  const direction = useLocaleDirection();
  useEffect(() => {
    document.documentElement.lang =
      getI18nConfig().resolveCanonicalLocale(locale);
    document.documentElement.dir = direction;
  }, [locale, direction]);
  return null;
}
