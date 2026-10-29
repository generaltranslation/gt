import { initializeGT as initializeReactGT } from 'gt-react';
import { createConditionStoreSingleton } from 'gt-i18n/internal';
import {
  config as pluginConfig,
  dictionary as pluginDictionary,
  loadDictionary as pluginLoadDictionary,
  loadTranslations as pluginLoadTranslations,
} from 'gt-tanstack-start/internal/_config';
import { AsyncLocalConditionStore } from '../condition-store/AsyncLocalConditionStore';
import {
  conditionStoreNotInitializedError,
  getConditionStore,
  isConditionStoreInitialized,
  setConditionStore,
} from '../condition-store/singleton';
import type { InitializeGTParams } from '../types/InitializeGTParams';

/** Whether the plugin's config routes by locale. */
export function isLocaleRoutingEnabled(): boolean {
  return (
    isConditionStoreInitialized() &&
    getConditionStore().isLocaleRoutingEnabled()
  );
}

/**
 * The runtime's shared condition store slot, which functions that run outside
 * React (such as `t()`) read the locale from.
 */
const { setConditionStore: setRuntimeConditionStore } =
  createConditionStoreSingleton<AsyncLocalConditionStore>(
    conditionStoreNotInitializedError
  );

/** Initialize GT and its server request condition store. */
function initialize(config: InitializeGTParams): void {
  initializeReactGT(config);
  const conditionStore = new AsyncLocalConditionStore(config);
  setConditionStore(conditionStore);
  // Request-scoped, so t() during server rendering reads the request locale.
  setRuntimeConditionStore(conditionStore);
}

/**
 * Initialize once from the Vite plugin's config. Without the plugin this is a
 * no-op, and reading request state throws the plugin setup error.
 */
export function ensureInitialized(): void {
  if (isConditionStoreInitialized() || !pluginConfig) return;
  initialize({
    ...pluginConfig,
    loadTranslations: pluginLoadTranslations,
    dictionary: pluginDictionary,
    loadDictionary: pluginLoadDictionary,
  });
}

/** Server condition store, initialized from the Vite plugin on first use. */
export function getServerConditionStore(): AsyncLocalConditionStore {
  ensureInitialized();
  return getConditionStore();
}
