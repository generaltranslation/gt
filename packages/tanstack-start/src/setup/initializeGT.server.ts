import { initializeGT as initializeReactGT } from 'gt-react';
import {
  config as pluginConfig,
  loadTranslations as pluginLoadTranslations,
} from 'gt-tanstack-start/internal/_config';
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

// A Vite dev server restart evaluates this module, and the plugin's loader, again, so outside production builds GT is set up once for each evaluation.
let initialized = false;

function isInitialized(): boolean {
  return process.env.NODE_ENV === 'production'
    ? isConditionStoreInitialized()
    : initialized;
}

/**
 * Initialize once from the Vite plugin's config. Without the plugin this is a
 * no-op, and reading request state throws the plugin setup error.
 */
export function ensureInitialized(): void {
  if (isInitialized() || !pluginConfig) return;
  initialize({
    ...pluginConfig,
    loadTranslations: pluginLoadTranslations,
  });
  initialized = true;
}

/** Server condition store, initialized from the Vite plugin on first use. */
export function getServerConditionStore(): AsyncLocalConditionStore {
  ensureInitialized();
  return getConditionStore();
}
