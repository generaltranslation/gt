import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { createGlobalSingleton } from '../globals/createGlobalSingleton';
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
 * Create the singleton DictionaryManager. Requires I18nConfig to be
 * initialized, since the source dictionary is keyed by the default locale.
 */
export function initializeDictionaryManager(
  params: DictionaryManagerParams = {}
): void {
  setDictionaryManager(new DictionaryManager(params));
}
