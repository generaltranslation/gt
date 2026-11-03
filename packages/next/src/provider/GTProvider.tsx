import { getLocale } from '../request/getLocale';
import { getRegion } from '../request/getRegion';
import type { GTProviderProps } from '../utils/types';
import { Client_GTProvider } from '../utils/client-boundary';
import { getNextI18nCache } from '../i18n-cache/NextI18nCache';
import { getI18nConfig } from 'gt-i18n/internal';
import { getEnableI18n } from '../request/getEnableI18n';
import { getRuntimeCredentials } from '../setup/runtimeCredentials';

export async function GTProvider({ children }: GTProviderProps) {
  // ---------- SETUP ---------- //
  const i18nCache = getNextI18nCache();
  const i18nConfig = getI18nConfig();
  const locale = await getLocale();
  const region = await getRegion();
  const enableI18n = await getEnableI18n();
  const translationRequired = i18nConfig.requiresTranslation(locale);
  const devCredentials = getDevCredentials(i18nConfig.isDevHotReloadEnabled());

  // ----- FETCH TRANSLATIONS FROM CACHE ----- //

  const translationsSnapshotPromise = translationRequired
    ? i18nCache.loadTranslations(locale)
    : Promise.resolve({});

  const dictionariesSnapshotPromise = i18nCache.loadDictionaries(locale);

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
      devCredentials={devCredentials}
    >
      {children}
    </Client_GTProvider>
  );
}

/**
 * The server-only development key, handed to the client for hot reload.
 * isDevHotReloadEnabled() is false outside development, so production
 * renders never serialize a key.
 */
function getDevCredentials(devHotReloadEnabled: boolean) {
  if (!devHotReloadEnabled) return undefined;
  const { projectId, devApiKey } = getRuntimeCredentials();
  return projectId && devApiKey ? { projectId, devApiKey } : undefined;
}
