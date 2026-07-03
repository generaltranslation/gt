import { createDiagnosticMessage } from 'generaltranslation/internal';
import { createGlobalSingleton } from 'gt-i18n/internal';
import { I18nStore } from './I18nStore';
import { readRenderStrategy } from '../setup/i18nConfig';

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
  const renderStrategy = readRenderStrategy();
  const errorMessage = createDiagnosticMessage({
    source: '@generaltranslation/react-core',
    severity: 'Error',
    whatHappened: 'Cannot access I18nStore before it is initialized.',
    fix:
      renderStrategy === 'SPA'
        ? 'Initialize GT before reading GT runtime context.'
        : renderStrategy === 'server-render'
          ? 'Add a <GTProvider> at the root of your component tree.'
          : 'Initialize GT before rendering and add a <GTProvider> at the root of your component tree.',
    details:
      renderStrategy === undefined
        ? 'The I18nConfig singleton is also uninitialized, so GT initialization has not run in this runtime. This can happen when a bundler drops GT setup side effects or an edge/serverless isolate loads a bundle that never runs initialization.'
        : undefined,
  });

  return new Error(errorMessage);
}
