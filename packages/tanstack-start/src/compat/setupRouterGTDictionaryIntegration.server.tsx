import type { GTIntegrableRouter, GTRouterOptions } from '../router/types';
import { getServerConditionStore } from '../setup/initializeGT.server';
import {
  createDictionaryRouterWrap,
  loadDictionaries,
  type GTDictionaryDehydratedRouterData,
} from './createDictionaryRouterWrap';
import { ensureDictionaryManager } from './dictionaryManager.server';

const integratedRouters = new WeakSet<GTIntegrableRouter>();

/**
 * Wire the dictionary API into a TanStack Router instance: loads the request
 * locale's dictionary before render, dehydrates it for the client, and wraps
 * the app in GTDictionaryProvider so useTranslations() can read it. Call it
 * in getRouter() beside setupRouterGTIntegration(), in either order.
 */
export function setupRouterGTDictionaryIntegration({
  router,
}: {
  router: GTIntegrableRouter;
}): void {
  if (integratedRouters.has(router)) return;
  integratedRouters.add(router);

  const { dehydrate: originalDehydrate } = router.options;
  const dictionaries = createDictionaryRouterWrap({
    Wrap: router.options.Wrap,
    ensureDictionaryManager,
    loadDictionaries: () =>
      loadDictionaries(getServerConditionStore().getLocale()),
  });
  const options: Partial<GTRouterOptions> = {
    // Start awaits dehydrate() after loaders and before render, so the
    // dictionaries are resolved by the time Wrap renders.
    dehydrate: async () => {
      const dehydrated = (await originalDehydrate?.()) as
        | Record<string, unknown>
        | undefined;
      const gtDictionaries: NonNullable<GTDictionaryDehydratedRouterData>['gtDictionaries'] =
        { dictionaries: await dictionaries.load() };
      if (router.isShell?.()) gtDictionaries.shell = true;
      return { ...dehydrated, gtDictionaries };
    },
    Wrap: dictionaries.Wrap,
  };
  router.update(options);
}
