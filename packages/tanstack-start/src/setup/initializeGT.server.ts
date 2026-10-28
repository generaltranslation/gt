import { initializeGT as initializeReactGT } from 'gt-react';
import {
  config as pluginConfig,
  loadTranslations as pluginLoadTranslations,
} from 'gt-tanstack-start/internal/_config';
// shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
import {
  dictionary as pluginDictionary,
  loadDictionary as pluginLoadDictionary,
} from 'gt-tanstack-start/internal/_compat-config';
import { AsyncLocalConditionStore } from '../condition-store/AsyncLocalConditionStore';
import {
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

/** Initialize GT and its server request condition store. */
function initialize(config: InitializeGTParams): void {
  initializeReactGT(config);
  setConditionStore(new AsyncLocalConditionStore(config));
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
    // shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
    dictionary: pluginDictionary,
    loadDictionary: pluginLoadDictionary,
  });
}

/** Server condition store, initialized from the Vite plugin on first use. */
export function getServerConditionStore(): AsyncLocalConditionStore {
  ensureInitialized();
  return getConditionStore();
}
