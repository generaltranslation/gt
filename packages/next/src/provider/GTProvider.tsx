import { getLocale } from '../request/getLocale';
import { getRegion } from '../request/getRegion';
import type { GTProviderProps } from '../utils/types';
import { Client_GTProvider } from '../utils/client-boundary';
import { getNextI18nCache } from '../i18n-cache/NextI18nCache';
import { getI18nConfig } from 'gt-i18n/internal';
import { getEnableI18n } from '../request/getEnableI18n';
import { loadDictionaries } from '../compat/dictionaries';

export async function GTProvider({ children }: GTProviderProps) {
  // ---------- SETUP ---------- //
  const i18nCache = getNextI18nCache();
  const i18nConfig = getI18nConfig();
  const locale = await getLocale();
  const region = await getRegion();
  const enableI18n = await getEnableI18n();
  const translationRequired = i18nConfig.requiresTranslation({ locale });

  // ----- FETCH TRANSLATIONS FROM CACHE ----- //

  const translationsSnapshotPromise = translationRequired
    ? i18nCache.loadTranslations(locale)
    : Promise.resolve({});

  // shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
  const dictionariesSnapshotPromise = loadDictionaries(locale);

  // Block until cache check resolves
  const translationsSnapshot = { [locale]: await translationsSnapshotPromise };
  const dictionariesSnapshot = await dictionariesSnapshotPromise;

  return (
    <Client_GTProvider
      supportsLocaleRefresh={
        process.env._GENERALTRANSLATION_LOCALE_REFRESH_SUPPORTED === 'true'
      }
      locale={locale}
      region={region}
      enableI18n={enableI18n}
      translations={translationsSnapshot}
      dictionaries={dictionariesSnapshot}
    >
      {children}
    </Client_GTProvider>
  );
}
