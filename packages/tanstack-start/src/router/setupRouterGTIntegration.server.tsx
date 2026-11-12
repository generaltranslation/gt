import { GTProvider } from 'gt-react';
import {
  ensureInitialized,
  getServerConditionStore,
  isLocaleRoutingEnabled,
} from '../setup/initializeGT.server';
import { createGTRouterWrap, readGTRouterState } from './createGTRouterWrap';
import {
  resolveIntegrationOptions,
  type RouterIntegrationOptions,
} from './resolveIntegrationOptions';
import { getRouterLocaleRewrite } from './localeRewrite';
import type {
  GTDehydratedRouterData,
  GTIntegrableRouter,
  GTRouterOptions,
  GTRouterState,
  SetupRouterGTIntegrationOptions,
} from './types';

const integratedRouters = new WeakSet<GTIntegrableRouter>();

/**
 * Wire GT into a TanStack Router instance: resolves the request locale, loads
 * its translations before render, dehydrates them for the client, and wraps
 * the app in GTProvider. With localeRouting, also rewrites locale prefixes so
 * routes and links stay locale-free.
 */
export function setupRouterGTIntegration(
  options: SetupRouterGTIntegrationOptions
): void {
  integrateRouter(resolveIntegrationOptions(options), {
    Provider: GTProvider,
    loadState: readGTRouterState,
  });
}

/**
 * @internal Wires GT into a router with the given provider and state, so the
 * `/compat` entry can add dictionaries to both.
 */
export function integrateRouter<State extends GTRouterState>(
  { router, localeRewrite }: RouterIntegrationOptions,
  {
    Provider,
    loadState,
  }: Pick<Parameters<typeof createGTRouterWrap<State>>[0], 'Provider'> & {
    loadState: (
      conditionStore: ReturnType<typeof getServerConditionStore>
    ) => Promise<State>;
  }
): void {
  if (integratedRouters.has(router)) return;
  integratedRouters.add(router);
  ensureInitialized();

  const { dehydrate: originalDehydrate } = router.options;
  const gt = createGTRouterWrap({
    Wrap: router.options.Wrap,
    Provider,
    loadState: () => loadState(getServerConditionStore()),
  });
  const options: Partial<GTRouterOptions> = {
    // Start awaits dehydrate() after loaders and before render, so
    // translations are resolved by the time Wrap renders.
    dehydrate: async () => {
      const dehydrated =
        (await originalDehydrate?.()) as GTDehydratedRouterData<State>;
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
  if (localeRewrite && isLocaleRoutingEnabled()) {
    // Resolved per call from the current request's conditions, not captured
    // at setup.
    options.rewrite = getRouterLocaleRewrite(router, () =>
      getServerConditionStore().getLocale()
    );
  }
  router.update(options);
}
