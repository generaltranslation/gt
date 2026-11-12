import {
  GTProvider as ReactGTProvider,
  type GTProviderProps,
} from 'gt-react/compat';
import { readGTRouterState } from '../router/createGTRouterWrap';
import { integrateRouter } from '../router/setupRouterGTIntegration.server';
import { resolveIntegrationOptions } from '../router/resolveIntegrationOptions';
import type { SetupRouterGTIntegrationOptions } from '../router/types';
import { ensureDictionaryManager } from './dictionaryManager.server';
import { loadDictionaries } from './dictionaries';

function GTProvider(props: GTProviderProps) {
  // The provider reads the source dictionary from the manager.
  ensureDictionaryManager();
  return <ReactGTProvider {...props} />;
}

/**
 * setupRouterGTIntegration() with dictionaries: also loads the request
 * locale's dictionaries for useTranslations(), dehydrates them for the client,
 * and renders GTProvider from 'gt-react/compat'. Call it instead of the one
 * from 'gt-tanstack-start'.
 */
export function setupRouterGTIntegration(
  options: SetupRouterGTIntegrationOptions
): void {
  integrateRouter(resolveIntegrationOptions(options), {
    Provider: GTProvider,
    loadState: async (conditionStore) => {
      ensureDictionaryManager();
      const [state, dictionaries] = await Promise.all([
        readGTRouterState(conditionStore),
        loadDictionaries(conditionStore.getLocale()),
      ]);
      return { ...state, dictionaries };
    },
  });
}
