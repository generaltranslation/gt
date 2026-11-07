import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { createGlobalSingleton } from 'gt-i18n/internal';
import { CompatStore } from './CompatStore';

const compatStoreSingleton = createGlobalSingleton<CompatStore>({
  namespace: 'reactCore',
  key: 'compatStore',
  source: '@generaltranslation/react-core',
  notInitialized: () =>
    createDiagnosticMessage({
      source: '@generaltranslation/react-core',
      severity: 'Error',
      whatHappened: 'Cannot access CompatStore before it is initialized.',
    }),
});

// shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
/**
 * The store useTranslations() falls back to outside a DictionaryProvider
 * (SPA apps that render without GTProvider). Created on first use.
 */
export function getCompatStore(): CompatStore {
  if (!compatStoreSingleton.isInitialized()) {
    compatStoreSingleton.set(new CompatStore());
  }
  return compatStoreSingleton.get();
}
