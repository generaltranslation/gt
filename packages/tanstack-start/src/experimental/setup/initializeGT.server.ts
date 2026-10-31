import { initializeGT as initializeReactGT } from 'gt-react/experimental';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { createConditionStoreSingleton } from 'gt-i18n/internal';
import {
  config as pluginConfig,
  dictionary as pluginDictionary,
  loadDictionary as pluginLoadDictionary,
  loadTranslations as pluginLoadTranslations,
} from 'gt-tanstack-start/internal/_config';
import {
  getConditionStore,
  isConditionStoreInitialized,
  setConditionStore,
} from '../../condition-store/singleton';
import type { InitializeGTParams } from '../../types/InitializeGTParams';
import { LocaleTwinConditionStore } from '../condition-store/LocaleTwinConditionStore';

/**
 * The server setup with locale twins: a copy of `setup/initializeGT.server.ts`
 * (keep in sync) that also gives the runtime the request condition store, and
 * whose store resolves the locale of any request. The experimental entry
 * points import this module instead of the regular one (experimentalImports.mts).
 */

const conditionStoreNotInitializedError = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Error',
  whatHappened: 'Cannot read GT server request state before initialization',
  why: 'the gtTanstackStart() Vite plugin is not registered, so GT has no config',
  fix: "Add gtTanstackStart() from 'gt-tanstack-start/experimental/plugin/vite' to the plugins in your Vite config",
});

/**
 * The runtime's shared condition store slot, which functions that run outside
 * React (such as `t()`) read the locale from.
 */
const { setConditionStore: setRuntimeConditionStore } =
  createConditionStoreSingleton<LocaleTwinConditionStore>(
    conditionStoreNotInitializedError
  );

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
  const conditionStore = new LocaleTwinConditionStore(config);
  setConditionStore(conditionStore);
  // Request-scoped, so t() during server rendering reads the request locale
  // (the source text the browser would render it from is stripped).
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
export function getServerConditionStore(): LocaleTwinConditionStore {
  ensureInitialized();
  return getConditionStore() as LocaleTwinConditionStore;
}
