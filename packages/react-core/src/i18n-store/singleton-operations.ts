import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import { I18nStore } from './I18nStore';
import { getRenderStrategy } from '../setup/globals';

// ===== I18n Store ===== //

let i18nStore: I18nStore | undefined;

export function getI18nStore(): I18nStore {
  if (!i18nStore) {
    let renderStrategy: ReturnType<typeof getRenderStrategy> | undefined;
    try {
      renderStrategy = getRenderStrategy();
    } catch {
      renderStrategy = undefined;
    }

    const errorMessage = createDiagnosticMessage({
      source: '@generaltranslation/react-core',
      severity: 'Error',
      whatHappened: 'Cannot access I18nStore before it is initialized.',
      details: formatDiagnosticErrorDetails(
        new Error('The internal I18nStore is unavailable')
      ),
      fix:
        renderStrategy === 'SPA'
          ? 'Initialize GT before reading GT runtime context.'
          : 'Add a <GTProvider> at the root of your component tree.',
    });
    throw new Error(errorMessage);
  }
  return i18nStore;
}

export function setI18nStore(nextStore: I18nStore): void {
  i18nStore = nextStore;
}

export function isI18nStoreInitialized(): boolean {
  return i18nStore !== undefined;
}
