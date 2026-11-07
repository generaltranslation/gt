import { getLocale } from '../request/getLocale';
import { getRegion } from '../request/getRegion';
import type { GTProviderProps } from '../utils/types';
import { Client_GTProvider } from '../utils/client-boundary';
import { getNextI18nCache } from '../i18n-cache/NextI18nCache';
import { getI18nConfig } from 'gt-i18n/internal';
import { getEnableI18n } from '../request/getEnableI18n';

/** The props the client GTProvider receives from the RSC GTProvider. */
export async function getGTProviderProps() {
  const i18nCache = getNextI18nCache();
  const i18nConfig = getI18nConfig();
  const locale = await getLocale();
  const region = await getRegion();
  const enableI18n = await getEnableI18n();
  const translationRequired = i18nConfig.requiresTranslation({ locale });
  const translations = translationRequired
    ? await i18nCache.loadTranslations(locale)
    : {};
  return {
    supportsLocaleRefresh:
      process.env._GENERALTRANSLATION_LOCALE_REFRESH_SUPPORTED === 'true',
    locale,
    region,
    enableI18n,
    translations: { [locale]: translations },
  };
}

export async function GTProvider({ children }: GTProviderProps) {
  return (
    <Client_GTProvider {...await getGTProviderProps()}>
      {children}
    </Client_GTProvider>
  );
}
