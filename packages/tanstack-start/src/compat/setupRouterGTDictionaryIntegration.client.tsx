import { getReadonlyConditionStore } from '@generaltranslation/react-core/pure';
import type { GTIntegrableRouter, GTRouterOptions } from '../router/types';
import {
  createDictionaryRouterWrap,
  loadDictionaries,
  type GTDictionaries,
  type GTDictionaryDehydratedRouterData,
} from './createDictionaryRouterWrap';
import { ensureDictionaryManager } from './dictionaryManager.client';

const integratedRouters = new WeakSet<GTIntegrableRouter>();

/**
 * Wire the dictionary API into a TanStack Router instance: hydrates the
 * server's dictionary snapshot before the first render and wraps the app in
 * GTDictionaryProvider so useTranslations() can read it. Call it in
 * getRouter() beside setupRouterGTIntegration(), in either order.
 */
export function setupRouterGTDictionaryIntegration({
  router,
}: {
  router: GTIntegrableRouter;
}): void {
  if (integratedRouters.has(router)) return;
  integratedRouters.add(router);

  const { hydrate: originalHydrate } = router.options;
  // A prerendered shell's dictionaries, which its first render still reads.
  let shellDictionaries: GTDictionaries = {};
  const dictionaries = createDictionaryRouterWrap({
    Wrap: router.options.Wrap,
    ensureDictionaryManager,
    // The visitor's dictionaries, for client-only roots (ssr: false) and SPA
    // shells.
    loadDictionaries: async () => ({
      ...shellDictionaries,
      ...(await loadDictionaries(getReadonlyConditionStore().getLocale())),
    }),
  });
  const options: Partial<GTRouterOptions> = {
    hydrate: async (dehydrated: GTDictionaryDehydratedRouterData) => {
      const snapshot = dehydrated?.gtDictionaries;
      if (snapshot?.shell) {
        shellDictionaries = snapshot.dictionaries;
        // A load failure is thrown from Wrap.
        await dictionaries.load().catch(() => undefined);
      } else if (snapshot) {
        dictionaries.resolve(snapshot.dictionaries);
      }
      await originalHydrate?.(dehydrated);
    },
    Wrap: dictionaries.Wrap,
  };
  router.update(options);
}
