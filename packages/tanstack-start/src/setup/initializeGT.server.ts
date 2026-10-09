import { initializeGT as initializeReactGT } from 'gt-react';
import {
  config as pluginConfig,
  dictionary as pluginDictionary,
  loadDictionary as pluginLoadDictionary,
  loadTranslations as pluginLoadTranslations,
} from 'gt-tanstack-start/internal/_config';
import { AsyncLocalConditionStore } from '../condition-store/AsyncLocalConditionStore';
import {
  getConditionStore,
  isConditionStoreInitialized,
  setConditionStore,
} from '../condition-store/singleton';
import type { InitializeGTParams } from '../types/InitializeGTParams';

/** Whether the initialized config, manual or from the plugin, routes by locale. */
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
 * @deprecated Add `gtTanstackStart()` from `gt-tanstack-start/plugin/vite` to
 * your Vite plugins and call `setupRouterGTIntegration({ router })` in
 * `getRouter()` instead. The plugin reads gt.config.json and takes the other
 * settings as options. See the README's migration section.
 */
export function initializeGT(config: InitializeGTParams): void {
  initialize(config);
}

/**
 * Initialize from the Vite plugin's config unless the app already called
 * initializeGT(). Without the plugin this is a no-op.
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
