import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
  libraryDefaultLocale,
} from 'generaltranslation/internal';
import {
  createConditionStoreSingleton,
  getRuntimeEnvironment,
} from 'gt-i18n/internal';
import type { ReadonlyConditionStoreInterface } from 'gt-i18n/internal/types';
import { readRenderStrategy } from '../setup/i18nConfig';

const conditionStoreNotInitializedError = createDiagnosticMessage({
  source: '@generaltranslation/react-core',
  severity: 'Error',
  whatHappened: 'Cannot read GT runtime context before it has been initialized',
  why: 'The internal ConditionStore is unavailable',
});

const { getConditionStore, setConditionStore, isConditionStoreInitialized } =
  createConditionStoreSingleton<ReadonlyConditionStoreInterface>(
    conditionStoreNotInitializedError
  );

/**
 * Opinionated decision: add a safety wrapper around the condition store to be more forgiving in production
 * TODO: perhaps this is how condition store should always be accessed
 */
function getReadonlyConditionStoreWithFallback(): ReadonlyConditionStoreInterface {
  try {
    return getConditionStore();
  } catch (error) {
    // Error handling
    // readRenderStrategy() must not throw here: if I18nConfig is also
    // uninitialized, a throwing getter would replace this diagnostic (and
    // skip the production fallback below) with a config error.
    const runtimeEnvironment = getRuntimeEnvironment();
    const renderStrategy = readRenderStrategy();
    const errorMessage = createDiagnosticMessage({
      source: '@generaltranslation/react-core',
      severity: 'Error',
      whatHappened: 'Cannot access ConditionStore before it is initialized.',
      details: formatDiagnosticErrorDetails(error),
      fix:
        renderStrategy === 'SPA'
          ? 'Initialize GT before reading GT runtime context.'
          : renderStrategy === 'server-render'
            ? 'Add a <GTProvider> at the root of your component tree.'
            : 'Initialize GT before rendering and add a <GTProvider> at the root of your component tree.',
      wayOut:
        runtimeEnvironment === 'development'
          ? undefined
          : renderStrategy === 'SPA'
            ? 'Request-specific values will fall back to the default configuration.'
            : 'Request-specific values will fall back to the default configuration. This may cause hydration mismatches.',
    });

    if (runtimeEnvironment === 'development') {
      throw new Error(errorMessage);
    } else {
      console.error(errorMessage);
    }

    // Fallback to default configuration (important: do not set globally)
    return {
      getLocale: () => libraryDefaultLocale,
      getRegion: () => undefined,
      getEnableI18n: () => true,
      setLocale: () => {},
      setRegion: () => {},
      setEnableI18n: () => {},
    };
  }
}

export {
  getReadonlyConditionStoreWithFallback,
  setConditionStore as setReadonlyConditionStore,
  isConditionStoreInitialized as isReadonlyConditionStoreInitialized,
};
