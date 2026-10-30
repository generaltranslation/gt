import { GTProvider } from 'gt-react/experimental';
import { isLocaleTwinsEnabled } from 'gt-i18n/internal/experimental';
import {
  ensureInitialized,
  getServerConditionStore,
  isLocaleRoutingEnabled,
} from '../../setup/initializeGT.server';
import { createGTRouterWrap } from '../../router/createGTRouterWrap';
import { getRouterLocaleRewrite } from '../../router/localeRewrite';
import type {
  GTDehydratedRouterData,
  GTIntegrableRouter,
  GTRouterOptions,
  SetupRouterGTIntegrationOptions,
} from '../../router/types';
import {
  setLocaleTwinDocumentHeaders,
  type RouteMatchHeaders,
} from '../locale-twins/documentHeaders';
import { readGTRouterState } from './readGTRouterState';

/** The router, with the matched routes Start builds the document from. */
type LocaleTwinRouter = GTIntegrableRouter & {
  state?: { matches: readonly RouteMatchHeaders[] };
};

const integratedRouters = new WeakSet<GTIntegrableRouter>();

/**
 * `setupRouterGTIntegration()` on the server with locale twins: like the
 * regular one, it resolves the request locale, loads its translations before
 * render and wraps the app in GTProvider, but it sends no translations
 * snapshot (the browser renders from its twins) and marks the document as
 * varying by locale.
 */
export function setupRouterGTIntegration({
  router,
  localeRewrite,
}: SetupRouterGTIntegrationOptions): void {
  if (integratedRouters.has(router)) return;
  integratedRouters.add(router);
  ensureInitialized();

  const twinRouter = router as LocaleTwinRouter;
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
      // The document varies by locale without a snapshot to show for it.
      if (isLocaleTwinsEnabled() && !router.isShell?.()) {
        setLocaleTwinDocumentHeaders(twinRouter.state?.matches ?? []);
      }
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
