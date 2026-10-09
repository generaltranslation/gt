import { createOrUpdateBrowserConditionStore } from 'gt-react';
import { getReadonlyConditionStore } from '@generaltranslation/react-core/pure';
import { GTProvider } from '../provider/GTProvider.client';
import {
  ensureInitialized,
  isLocaleRoutingEnabled,
} from '../setup/initializeGT.client';
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
 * Wire GT into a TanStack Router instance: hydrates the server's locale and
 * translations before the first render and wraps the app in GTProvider. With
 * localeRouting, also rewrites locale prefixes so routes and links stay
 * locale-free.
 */
export function setupRouterGTIntegration({
  router,
  localeRewrite,
}: SetupRouterGTIntegrationOptions): void {
  if (integratedRouters.has(router)) return;
  integratedRouters.add(router);
  ensureInitialized();

  const { hydrate: originalHydrate } = router.options;
  const gt = createGTRouterWrap({
    Wrap: router.options.Wrap,
    Provider: GTProvider,
    // Client-only roots (ssr: false, SPA mode) receive no dehydrated state.
    loadState: () => readGTRouterState(getReadonlyConditionStore()),
  });
  const options: Partial<GTRouterOptions> = {
    // Apply the server's locale first, so the app's hydrate callback and the
    // links it builds see it.
    hydrate: async (dehydrated: GTDehydratedRouterData) => {
      if (dehydrated?.gt) {
        const { locale, region, enableI18n } = dehydrated.gt;
        gt.resolve(dehydrated.gt);
        createOrUpdateBrowserConditionStore({ locale, region, enableI18n });
      }
      await originalHydrate?.(dehydrated);
    },
    Wrap: gt.Wrap,
  };
  // Installed now rather than in hydrate: Router parses the initial location
  // through the rewrite before hydrating.
  if (localeRewrite !== false && isLocaleRoutingEnabled()) {
    options.rewrite = getRouterLocaleRewrite(router, () =>
      getReadonlyConditionStore().getLocale()
    );
  }
  router.update(options);
}
