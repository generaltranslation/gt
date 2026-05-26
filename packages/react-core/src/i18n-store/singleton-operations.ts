import { createDiagnosticMessage } from 'generaltranslation/internal';
import { I18nStore } from './I18nStore';
import { getRenderStrategy } from '../setup/globals';

// ===== I18n Store ===== //

let i18nStore: I18nStore | undefined;

export function getI18nStore(): I18nStore {
  if (!i18nStore) {
    throw createI18nStoreNotInitializedError();
  }
  return i18nStore;
}

export function setI18nStore(nextStore: I18nStore): void {
  i18nStore = nextStore;
}

export function isI18nStoreInitialized(): boolean {
  return i18nStore !== undefined;
}

function createI18nStoreNotInitializedError(): Error {
  const renderStrategy = getRenderStrategy();
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
