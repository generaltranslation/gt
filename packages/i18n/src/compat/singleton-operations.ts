import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import logger from '../logs/logger';
import { createGlobalSingleton } from '../globals/createGlobalSingleton';
import { DEFAULT_CACHE_EXPIRY_TIME } from '../i18n-cache/translations-manager/utils/constants';
import {
  DictionaryManager,
  type DictionaryManagerParams,
} from './DictionaryManager';

// Pure so bundlers drop it from apps that never use the dictionary API.
const dictionaryManagerSingleton =
  /* @__PURE__ */ createGlobalSingleton<DictionaryManager>({
    namespace: 'i18n',
    key: 'dictionaryManager',
    source: 'gt-i18n',
    notInitialized: () =>
      createDiagnosticMessage({
        source: 'gt-i18n',
        severity: 'Error',
        whatHappened:
          'Cannot read the dictionary manager before it has been initialized',
        why: 'the internal DictionaryManager singleton is unavailable',
        fix: "Call initializeGTDictionary() from your GT package's /compat entry after initializeGT(), before using useTranslations() or getTranslations().",
      }),
  });

/**
 * Get the singleton DictionaryManager
 */
export function getDictionaryManager(): DictionaryManager {
  return dictionaryManagerSingleton.get();
}

/**
 * Set the singleton DictionaryManager
 */
export function setDictionaryManager(
  dictionaryManager: DictionaryManager
): void {
  dictionaryManagerSingleton.set(dictionaryManager);
}

/**
 * Whether the singleton DictionaryManager has been set
 */
export function isDictionaryManagerInitialized(): boolean {
  return dictionaryManagerSingleton.isInitialized();
}

/**
 * Validate the params, fill in their defaults and create the singleton
 * DictionaryManager. Requires I18nConfig to be initialized, since the source
 * dictionary is keyed by the default locale.
 *
 * @throws {Error} If `loadDictionary` is set without `dictionary`.
 */
export function initializeDictionaryManager(
  params: DictionaryManagerParams = {}
): void {
  // loadDictionary requires dictionary so the default locale always has a
  // source dictionary
  if (params.loadDictionary && !params.dictionary) {
    logger.error(
      'DictionaryManager: ' +
        createDiagnosticMessage({
          whatHappened: 'loadDictionary needs a source dictionary',
          fix: 'Provide dictionary so the default locale has source content',
        })
    );
    throw new Error('Validation errors occurred');
  }
  setDictionaryManager(
    new DictionaryManager({
      dictionary: params.dictionary ?? {},
      loadDictionary: params.loadDictionary ?? (() => Promise.resolve({})),
      cacheExpiryTime:
        params.cacheExpiryTime === undefined
          ? DEFAULT_CACHE_EXPIRY_TIME
          : params.cacheExpiryTime,
    })
  );
}
