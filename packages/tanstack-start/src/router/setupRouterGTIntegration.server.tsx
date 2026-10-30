import { GTProvider } from 'gt-react';
import {
  ensureInitialized,
  getServerConditionStore,
  isLocaleRoutingEnabled,
} from '../setup/initializeGT.server';
import { createGTRouterWrap, readGTRouterState } from './createGTRouterWrap';
import { getRouterLocaleRewrite } from './localeRewrite';
import type {
  GTDehydratedRouterData,
  GTIntegrableRouter,
  GTRouterOptions,
  SetupRouterGTIntegrationOptions,
} from './types';

const integratedRouters = new WeakSet<GTIntegrableRouter>();

/**
 * Wire GT into a TanStack Router instance: resolves the request locale, loads
 * its translations before render, dehydrates them for the client, and wraps
 * the app in GTProvider. With localeRouting, also rewrites locale prefixes so
 * routes and links stay locale-free.
 */
export function setupRouterGTIntegration({
  router,
  localeRewrite,
}: SetupRouterGTIntegrationOptions): void {
  if (integratedRouters.has(router)) return;
  integratedRouters.add(router);
  ensureInitialized();

  const { dehydrate: originalDehydrate } = router.options;
  const gt = createGTRouterWrap({
    Wrap: router.options.Wrap,
    Provider: GTProvider,
    loadState: () => readGTRouterState(getServerConditionStore()),
  });
  const options: Partial<GTRouterOptions> = {
    // Start awaits dehydrate() after loaders and before render, so
    // translations are resolved by the time Wrap renders.
    dehydrate: async () => {
      const dehydrated =
        (await originalDehydrate?.()) as GTDehydratedRouterData;
      const state = await gt.load();
      // A prerendered SPA shell is served to every visitor in the build-time
      // locale. The client hydrates it with that state, then renders the
      // visitor's own.
      return {
        ...dehydrated,
        gt: router.isShell?.() ? { ...state, shell: true } : state,
      };
    },
    Wrap: gt.Wrap,
  };
  if (localeRewrite !== false && isLocaleRoutingEnabled()) {
    // Resolved per call from the current request's conditions, not captured
    // at setup.
    options.rewrite = getRouterLocaleRewrite(router, () =>
      getServerConditionStore().getLocale()
    );
  }
  router.update(options);
}
