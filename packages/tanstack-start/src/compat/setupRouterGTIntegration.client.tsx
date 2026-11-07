import {
  GTProvider as ReactGTProvider,
  type GTProviderProps,
} from 'gt-react/compat';
import { readGTRouterState } from '../router/createGTRouterWrap';
import { integrateRouter } from '../router/setupRouterGTIntegration.client';
import type { SetupRouterGTIntegrationOptions } from '../router/types';
import { getClientReload } from '../setup/initializeGT.client';
import { ensureDictionaryManager } from './dictionaryManager.client';
import { loadDictionaries } from './dictionaries';

function GTProvider(props: GTProviderProps) {
  // The provider reads the source dictionary from the manager.
  ensureDictionaryManager();
  return <ReactGTProvider {...props} _reload={getClientReload()} />;
}

/**
 * setupRouterGTIntegration() with dictionaries: also hydrates the server's
 * dictionaries for useTranslations() and renders GTProvider from
 * 'gt-react/compat'. Call it instead of the one from 'gt-tanstack-start'.
 */
export function setupRouterGTIntegration(
  options: SetupRouterGTIntegrationOptions
): void {
  integrateRouter(options, {
    Provider: GTProvider,
    // The visitor's state, for client-only roots (ssr: false) and SPA shells.
    loadState: async (conditionStore) => {
      ensureDictionaryManager();
      const state = await readGTRouterState(conditionStore);
      return { ...state, dictionaries: await loadDictionaries(state.locale) };
    },
  });
}
