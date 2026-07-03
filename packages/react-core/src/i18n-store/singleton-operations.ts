import { createDiagnosticMessage } from 'generaltranslation/internal';
import { createGlobalSingleton } from 'gt-i18n/internal';
import { I18nStore } from './I18nStore';
import { getI18nConfig } from '../setup/i18nConfig';

// ===== I18n Store ===== //

const i18nStoreSingleton = createGlobalSingleton<I18nStore>({
  namespace: 'reactCore',
  key: 'i18nStore',
  source: '@generaltranslation/react-core',
  notInitialized: () => createI18nStoreNotInitializedError(),
});

export const getI18nStore = i18nStoreSingleton.get;
export const setI18nStore = i18nStoreSingleton.set;
export const isI18nStoreInitialized = i18nStoreSingleton.isInitialized;

function createI18nStoreNotInitializedError(): Error {
  // If I18nConfig is uninitialized, getI18nConfig() throws its own
  // not-initialized error: GT initialization never ran, which is the root
  // cause and carries its own fix.
  const renderStrategy = getI18nConfig().getRenderStrategy();
  const errorMessage = createDiagnosticMessage({
    source: '@generaltranslation/react-core',
    severity: 'Error',
    whatHappened: 'Cannot access I18nStore before it is initialized.',
    fix:
      renderStrategy === 'SPA'
        ? 'Initialize GT before reading GT runtime context.'
        : 'Add a <GTProvider> at the root of your component tree.',
  });

  return new Error(errorMessage);
}
