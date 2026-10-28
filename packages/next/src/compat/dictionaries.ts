import {
  getDictionaryManager,
  getI18nConfig,
  initializeDictionaryManager,
  isDictionaryManagerInitialized,
  type Locale,
} from 'gt-i18n/internal';
import type { Dictionary } from 'gt-i18n';
import { getParams } from '../setup/shared';
import { getDictionary } from './getDictionary';
import { resolveDictionaryLoader } from './resolveDictionaryLoader';

/**
 * Initialize the DictionaryManager from the bundled dictionary and dictionary
 * loader on first use, so only compat code pulls them into the bundle.
 */
export function ensureNextDictionaryManager(): void {
  if (isDictionaryManagerInitialized()) return;
  const loadDictionary = resolveDictionaryLoader();
  initializeDictionaryManager({
    dictionary: getDictionary() ?? {},
    ...(loadDictionary && {
      loadDictionary: async (locale: string) =>
        ((await loadDictionary(locale)) || {}) as Dictionary,
    }),
    cacheExpiryTime: getParams().nextI18nCacheParams.cacheExpiryTime,
  });
}

/**
 * Snapshot of the requested locale's dictionary and the source dictionary,
 * streamed from the server to the client
 */
export async function loadDictionaries(
  locale: Locale
): Promise<Record<Locale, Dictionary>> {
  ensureNextDictionaryManager();
  const defaultLocale = getI18nConfig().getDefaultLocale();
  return {
    [locale]: await getDictionaryManager().loadDictionary(locale),
    ...(locale !== defaultLocale && {
      [defaultLocale]: getDictionary() || {},
    }),
  };
}
