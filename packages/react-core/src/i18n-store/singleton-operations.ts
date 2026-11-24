import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { createGlobalSingleton } from 'gt-i18n/internal';
import type { I18nStore } from './I18nStore';
import { getI18nConfig } from '../setup/i18nConfig';

// ===== I18n Store ===== //

// Pure so bundlers drop it from production clients that create no store.
const i18nStoreSingleton = /* @__PURE__ */ createGlobalSingleton<I18nStore>({
  namespace: 'reactCore',
  key: 'i18nStore',
  notInitialized: () => createI18nStoreNotInitializedError(),
});

export function getI18nStore(): I18nStore {
  return i18nStoreSingleton.get();
}
export function setI18nStore(i18nStore: I18nStore): void {
  i18nStoreSingleton.set(i18nStore);
}
export function isI18nStoreInitialized(): boolean {
  return i18nStoreSingleton.isInitialized();
}

function createI18nStoreNotInitializedError(): Error {
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
