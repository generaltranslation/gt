import { getLocale } from '../request/getLocale';
import { getRegion } from '../request/getRegion';
import type { GTProviderProps } from '../utils/types';
import { Client_GTProvider } from '../utils/client-boundary';
import { getReactI18nCache } from '@generaltranslation/react-core/pure';
import { getI18nConfig, type Locale } from 'gt-i18n/internal';
import { getEnableI18n } from '../request/getEnableI18n';

/** The props the client GTProvider receives from the RSC GTProvider. */
export async function getGTProviderProps(locale: Locale) {
  const i18nCache = getReactI18nCache();
  const i18nConfig = getI18nConfig();
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
    <Client_GTProvider {...await getGTProviderProps(await getLocale())}>
      {children}
    </Client_GTProvider>
  );
}
