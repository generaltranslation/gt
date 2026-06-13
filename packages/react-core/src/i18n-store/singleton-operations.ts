import { createDiagnosticMessage } from 'generaltranslation/internal';
import { I18nStore } from './I18nStore';
import { getI18nConfig } from '../setup/i18nConfig';

// ===== I18n Store ===== //

type ReactCoreGlobals = {
  i18nStore?: I18nStore;
  [key: string]: unknown;
};

type GeneralTranslationGlobal = {
  reactCore?: ReactCoreGlobals;
  [key: string]: unknown;
};

type GlobalWithGeneralTranslation = {
  __generaltranslation?: GeneralTranslationGlobal;
};

function getReactCoreGlobals(): ReactCoreGlobals {
  const globalObj = globalThis as unknown as GlobalWithGeneralTranslation;
  globalObj.__generaltranslation ??= {};
  // TODO: Consider checking package versions and using a compatibility matrix before sharing global singletons.
  globalObj.__generaltranslation.reactCore ??= {};
  return globalObj.__generaltranslation.reactCore;
}

export function getI18nStore(): I18nStore {
  const i18nStore = getReactCoreGlobals().i18nStore;
  if (!i18nStore) {
    throw createI18nStoreNotInitializedError();
  }
  return i18nStore;
}

export function setI18nStore(nextStore: I18nStore): void {
  const reactCoreGlobals = getReactCoreGlobals();
  if (reactCoreGlobals.i18nStore && reactCoreGlobals.i18nStore !== nextStore) {
    console.warn(createI18nStoreOverwriteWarning());
  }
  reactCoreGlobals.i18nStore = nextStore;
}

export function isI18nStoreInitialized(): boolean {
  return getReactCoreGlobals().i18nStore !== undefined;
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

function createI18nStoreOverwriteWarning(): string {
  return createDiagnosticMessage({
    source: '@generaltranslation/react-core',
    severity: 'Warning',
    whatHappened: 'Overwriting global i18nStore singleton instance',
  });
}
